require('dotenv').config();
const express = require('express');
const fs = require('fs');
const puppeteer = require('puppeteer');

// ****************************************************** //
// ****************************************************** //
// ******                  STOP!                  ******* //
// ******      CHECK THE README BEFORE USING      ******* //
// ******                  ENJOY                  ******* //
// ******                   🥀                   ******* //
// ****************************************************** //
// ****************************************************** //

const main = async () => {
  try {
    const browser = await puppeteer.launch({
      headless: false,
      slowMo: 20,
    });
    const page = await browser.newPage();

    // change this to the artist you want to find on dungeon-codex
    const ARTIST_TO_FIND = 'Wooden Vessels';

    // change this to the bandcamp url you want data from
    const URL_TO_FETCH =
      'https://cavebirdrecords.bandcamp.com/album/to-slumber-beneath-a-blanket-of-white';

    let description = '';
    let imageFileExtension = '';
    let imageFileName = '';
    let imageFilePath = '';
    let releaseDate = '';
    let title = '';
    let trackList = [];
    let url = '';

    function formatDate(copy) {
      const extractDate = copy.match(
        /(January|February|March|April|May|June|July|August|September|October|November|December)\s[0-9]{1,2}\,\s[0-9]{4}/gm
      );

      const date = new Date(extractDate);
      const year = date.getFullYear();
      const month = (1 + date.getMonth()).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');

      releaseDate = `${month}/${day}/${year}`;
    }

    function formatDetails(about, credits) {
      description = `${about} ${credits}`;
    }

    // get data from bandcamp
    await page.setDefaultNavigationTimeout(10000);
    await page.setViewport({ width: 700, height: 700 });
    await page.goto(URL_TO_FETCH);

    imageFileName = URL_TO_FETCH.match(/\/([^\/]+)\/?$/)[1];
    url = await page.url();

    await page.waitForSelector('#name-section');
    let $title = await page.$('#name-section .trackTitle');
    title = await page.evaluate((el) => el.textContent, $title);

    const $image = await page.waitForSelector('#tralbumArt a img');
    const imageURL = await $image.evaluate((img) => img.getAttribute('src'));
    imageFileExtension = imageURL.match(/[^.]+?$/g);
    imageFilePath = `./images/${imageFileName}.${imageFileExtension}`;
    const pageNew = await browser.newPage();
    const response = await pageNew.goto(imageURL);
    const imageBuffer = await response.buffer();
    await fs.promises.writeFile(imageFilePath, imageBuffer);
    await pageNew.close();

    let $about = await page.$('.tralbum-about');
    let aboutCopy = await page.evaluate((el) => el?.textContent, $about);

    if (aboutCopy === undefined) aboutCopy = '';

    let $credits = await page.$('.tralbum-credits');
    let creditsCopy = await page.evaluate((el) => el.textContent, $credits);

    formatDate(creditsCopy);

    formatDetails(aboutCopy, creditsCopy);

    if (await page.$('#track_table')) {
      trackList = await page.evaluate(() => {
        const tds = Array.from(
          document.querySelectorAll('#track_table tbody tr .title-col')
        );

        return tds.map((td) => {
          return {
            title: td.querySelector('.track-title').innerText.trim(),
            length: td.querySelector('.time').innerText.trim(),
          };
        });
      });
    } else {
      const $length = await page.$('.time_total');
      const length = await page.evaluate((el) => el.textContent, $length);

      trackList = [{ title: title.trim(), length: length.trim() }];
    }

    // add data to dungeon-codex
    await page.goto('https://www.dungeon-codex.com/');
    await page.waitForSelector('#menuBtn');
    await page.click('#menuBtn');
    await page.waitForSelector('[data-url="/login"]');
    await page.click('[data-url="/login"] a');

    await page.waitForSelector('#email');
    await page.type('#email', process.env.UN);
    await page.type('#password', process.env.PW);
    await page.click('[type="submit"]');

    await page.waitForSelector('#searchBtn');
    await page.click('#searchBtn');
    await page.waitForSelector('#searchText');
    await page.type('#searchText', ARTIST_TO_FIND);
    await page.click('[type="button"]');
    await page.waitForSelector('#searchCard');
    await page.click('#searchCard a');
    await page.waitForSelector(
      '.flex-row.my-1 + .flex.flex-row.justify-center div a'
    );
    await page.click('.flex-row.my-1 + .flex.flex-row.justify-center div a');

    // upload image & fill out form
    const [uploadEl] = await Promise.all([
      page.waitForFileChooser(),
      page.click('#cover'),
    ]);
    await uploadEl.accept([imageFilePath]);

    await page.waitForSelector('#title');
    await page.type('#title', title.trim());
    await page.type('#releaseDate', releaseDate);

    if (description) {
      await page.type(
        '#details',
        description
          .replace(/[^\S\r\n]{2,}/g, '')
          .replace(/\n{3}/g, '\n')
          .trim()
      );
    }

    for (let i = 0; i < trackList.length; i++) {
      const curTrack = i + 1;

      await page.type(`#track${curTrack}_title`, trackList[i].title);
      await page.type(`#track${curTrack}_duration`, trackList[i].length);

      if (curTrack < trackList.length) {
        await page.click('#addTrack');
      }
    }

    await page.type('#ed1_label', 'Self-Release');
    await page.type('#ed1_format', 'Digital');
    await page.type('#ed1_releaseDate', releaseDate);
    await page.type('#ed1_url', url);

    await page.waitForSelector('#submitAlbum');
    await page.click('#submitAlbum');

    // success messages
    console.log(`fetch attempted at ${new Date().toLocaleTimeString()}`);
    console.log('title:', title.trim());
    console.log('releaseDate:', releaseDate.trim());
    console.log('trackList:', trackList);
    console.log('url:', url);
  } catch (error) {
    console.error(error);
  }
};

// start the automation
main();

// start the server
app = express();
app.listen(3000);
console.log(`Listening on port 3000`);
