import fs from 'fs';
import os from 'os';

const
  PATH_STOP_WORDS = './stopwords.txt',
  RE_INVALID_CHARS = /[\uFFFD\0\r\n]/g,
  RE_NON_ALPHA_NUMBERIC_CHARS = /[^a-zA-Z0-9]+/g,
  RE_WHITESPACE = /\s/g;

export function extractWordsFromField (data, fieldName = 'Text Response') {
  let wordMap = new Map();

  if (!data || !data.length) {
    return wordMap;
  }

  data.forEach((record) => {
    if (!record[fieldName]) {
      return;
    }

    record[fieldName]
      .split(RE_WHITESPACE)
      .forEach((word) => {
        word = word.toLowerCase().replace(RE_NON_ALPHA_NUMBERIC_CHARS, '');

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

  return wordMap;
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
    return filtered;
  }

  if (words instanceof Map) {
    filtered = Array.from(words.values());
  }

  await readUTF8File(PATH_STOP_WORDS, (chunk) => {
    stopWords = stopWords.concat(chunk.split(os.EOL));
  });

  return filtered.filter((word) => (stopWords.indexOf(word.word) < 0));
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

export function sortWords (words) {
  let sorted = [];

  if (!words) {
    return sorted;
  }

  if (words instanceof Map) {
    sorted = Array.from(words.values());
  }

  // sort descending by count
  sorted.sort((a, b) => ((a.count > b.count) ? -1 : 1));

  return sorted;
}
