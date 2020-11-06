#!/bin/sh
// eslint-disable-next-line semi, quotes, spaced-comment
":" //# comment; exec /usr/bin/env node --experimental-modules "$0" "$@"

import { extractWordsFromField, fileExists, filterStopWords, readUTF8CSVFile, renderWordCloudAsPNG, saveFile, sortWords } from './functions.mjs';

/* eslint no-console: 0 */
export default (async (app) => {
  // capture args
  app.args = process.argv.slice(2);

  if (!app.args.length) {
    console.error('Path to CSV file and to destination image required.');
    process.exit(1);
  }

  let
    data,
    exists = await fileExists(app.args[0]);

  if (!exists) {
    console.error('Invalid file path provided (%s)', app.args[0]);
    process.exit(1);
  }

  if (!app.args[1]) {
    console.error('Path to destination image required.');
    process.exit(1);
  }

  try {
    data = await readUTF8CSVFile(app.args[0]);
  } catch (ex) {
    console.error(ex);
    process.exit(2);
  }

  await extractWordsFromField(data)
    .then(filterStopWords)
    /*
    .then((data) => {
      console.log(data);
      return Promise.resolve(data);
    })
    //*/
    .then(sortWords)
    /*
    .then((words) => {
      // filter list of words...
      return Promise.resolve(words.slice(0, 10));
    })
    //*/
    .then(renderWordCloudAsPNG)
    .then((image) => saveFile(image, app.args[1]))
    .then(() => {
      console.log('word cloud rendering complete: %s', app.args[1]);
    })
    .catch(console.error);
})({});