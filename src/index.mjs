#!/bin/sh
// eslint-disable-next-line semi, quotes, spaced-comment
":" //# comment; exec /usr/bin/env node --experimental-modules "$0" "$@"

import { extractWordsFromField, fileExists, filterStopWords, readUTF8CSVFile, sortWords } from './functions.mjs';

export default (async (app) => {
  // capture args
  app.args = process.argv.slice(2);

  if (!app.args.length) {
    console.error('Path to CSV file required.');
    process.exit(1);
  }

  let
    data,
    exists = await fileExists(app.args[0]);

  if (!exists) {
    console.error('Invalid file path provided (%s)', app.args[0]);
    process.exit(1);
  }

  try {
    data = await readUTF8CSVFile(app.args[0]);
  } catch (ex) {
    console.error(ex);
    process.exit(2);
  }

  let words = await filterStopWords(extractWordsFromField(data));


  console.log(sortWords(words));
})({});