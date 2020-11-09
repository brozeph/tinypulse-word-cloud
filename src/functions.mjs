import fs from 'fs';
import os from 'os';

import d3, { color } from 'd3';
import cloud from 'd3-cloud';
import puppeteer from 'puppeteer';
import randomColor from 'randomcolor';

import { JSDOM } from 'jsdom';

global.document = new JSDOM("<!DOCTYPE html><body></body>").window.document;

// import Levenshtein from 'levenshtein';

const
  PATH_STOP_WORDS = './stopwords.txt',
  RE_INVALID_CHARS = /[\uFFFD\0\r\n]/g,
  RE_NON_WORD_CHARS = /[^a-zA-Z0-9\-\']+/g,
  RE_WHITESPACE = /\s/g;

/*
export function consolidateWordsByDistance (words) {
  let consolidated = [];

  if (!words) {
    return Promise.resolve(consolidated);
  }

  if (words instanceof Map) {
    consolidated = Array.from(words.values());
  }

  // handle scenarios where inbound words are in an Array
  consolidated = consolidated.length ? consolidated : words;


  return Promise.resolve(consolidated);
}
//*/

export function extractWordsFromField (data, fieldName = 'Text Response') {
  let wordMap = new Map();

  if (!data || !data.length) {
    return Promise.resolve(wordMap);
  }

  data.forEach((record) => {
    if (!record[fieldName]) {
      return;
    }

    record[fieldName]
      .split(RE_WHITESPACE)
      .forEach((word) => {
        word = word.toLowerCase().replace(RE_NON_WORD_CHARS, '');

        // ensure no blank words
        if (!word || !word.length) {
          return;
        }

        // increment the existing word count when already existing
        if (wordMap.has(word)) {
          wordMap.get(word).count ++;
          return;
        }

        // capture the new word with count
        wordMap.set(word, { count : 1, word });
      });
  });

  return Promise.resolve(wordMap);
}

export function fileExists (filePath) {
  if (!filePath) {
    return Promise.reject(new Error('filePath is required'));
  }

  return new Promise((resolve, reject) => {
    return fs.access(filePath, fs.constants.R_OK, (err) => {
      if (err) {
        return reject(err);
      }

      return resolve(true);
    });
  });
}

export async function filterStopWords (words) {
  let
    filtered = [],
    stopWords = [];

  if (!words) {
    return Promise.resolve(filtered);
  }

  if (words instanceof Map) {
    filtered = Array.from(words.values());
  }

  // handle scenarios where inbound words are in an Array
  filtered = filtered.length ? filtered : words;

  await readUTF8File(PATH_STOP_WORDS, (chunk) => {
    stopWords = stopWords.concat(chunk.split(os.EOL));
  });

  filtered = filtered.filter((word) => stopWords.indexOf(word.word) === -1);

  return Promise.resolve(filtered);
}

export async function readUTF8CSVFile (filePath, colDelim = /\t/g, rowDelim = os.EOL) {
  if (!filePath) {
    throw new Error('filePath is required');
  }

  let
    data = [],
    fields = [],
    lines = [],
    segment = '';

  await readUTF8File(filePath, (chunk) => {
    chunk = chunk.toString();

    let segmentLines = [segment, chunk].join('').split(rowDelim);

    // detect first row from spreadsheet as field names
    if (!lines.length) {
      fields = segmentLines.shift().replace(RE_INVALID_CHARS, '').split(colDelim);
    }

    segmentLines.forEach((line) => {
      let
        cols = line.replace(RE_INVALID_CHARS, '').split(colDelim),
        obj = {};

      // handle incomplete line from chunk of data
      if (!cols.length || cols.length < fields.length) {
        segment = line;
        return;
      }

      // create object with column values
      cols.forEach((val, i) => (obj[fields[i]] = val));

      // store the object
      data.push(obj);
    });
  });

  return data;
}

export function readUTF8File (filePath, onData) {
  if (!filePath) {
    return Promise.reject(new Error('filePath is required'));
  }

  return new Promise((resolve, reject) => {
    let stream = fs.createReadStream(filePath);

    stream.setEncoding('utf-8');

    stream.once('open', () => {
      // process the data via callback
      stream.on('data', onData);

      // close out the stream
      stream.once('end', () => {
        // clean up and close down the reader
        stream.removeAllListeners('data');
        stream.removeAllListeners('end');
        stream.removeAllListeners('error');
        stream.close();

        // resolve
        return resolve();
      });
    });

    // reject on error
    stream.once('error', reject);
  });
}

export async function renderWordCloudAsPNG (words, height = 610, width = 610) {
  let
    browser,
    document = global.document,
    image,
    page,
    values = [];

  if (words instanceof Map) {
    values = Array.from(words.values());
  }

  // handle scenarios where inbound words are in an Array
  values = values.length ? values : words;
  values = values.map((word) => ({ count : word.count, text : word.word }));

  // render to HTML using d3.js
  await new Promise((resolve) => {
    cloud()
      .size([width, height])
      .words(values)
      /*.rotate(() => {
        return ~~(Math.random() * 2) * 90;
      })//*/
      .padding(() => '1em')
      .font("Impact")
      .fontSize((d) => {
        return d.count;
      })
      .on("end", (cloudWords) => {
        let svg = d3.select(document.body).append('svg');

        svg
          .attr('width', width)
          .attr('height', height)
          .append('g')
          .attr('transform', `translate(${width / 2}, ${height / 2})`)
          .selectAll('text')
          .data(cloudWords)
          .enter()
          .append('text')
          .style('font-size', (w) => [w.count, 'em'].join('')) //[w.count, 'em'].join(''))
          .style('font-family', 'Impact')
          //.style('fill', (w, i) => d3.scaleLinear(d3.schemeCategory10)(i))
          .style('fill', () => randomColor())
          .attr('text-anchor', 'middle')
          .attr('transform', (w) => [
            'translate(',
            w.x,
            ', ',
            w.y,
            ') rotate(',
            w.rotate,
            ')'].join(''))
          .text((w) => w.text);

        return resolve();
      })
      .start();
  });

  // convert HTML to PNG with puppeteer
  browser = await puppeteer.launch();
  page = await browser.newPage();
  await page.setViewport({
    deviceScaleFactor : 1,
    height,
    width
  });

  console.log(document.body.innerHTML);

  await page.setContent(document.body.outerHTML);
  image = await page.screenshot({
    encoding : 'binary',
    omitBackground : false,
    type : 'png'
  });
  await browser.close();

  return image;
}

export function saveFile (data, filePath) {
  if (!filePath) {
    return Promise.reject(new Error('filePath is required'));
  }

  if (!data || !data.length) {
    return Promise.reject(new Error('data is required'));
  }

  return new Promise((resolve, reject) => {
    let stream = fs.createWriteStream(filePath, { encoding : 'binary' });

    stream.once('open', () => {
      stream.end(data);
      return stream.once('finish', resolve);
    });

    // reject on error
    stream.once('error', reject);
  });
}

export function sortWords (words) {
  let sorted = [];

  if (!words) {
    return Promise.resolve(sorted);
  }

  if (words instanceof Map) {
    sorted = Array.from(words.values());
  }

  // handle scenarios where inbound words are in an Array
  sorted = sorted.length ? sorted : words;

  // sort descending by count
  sorted.sort((a, b) => ((a.count > b.count) ? -1 : 1));

  return Promise.resolve(sorted);
}
