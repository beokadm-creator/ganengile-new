const url = new URL('https://openapi.kric.go.kr/openapi/convenientInfo/stationLocker');
url.searchParams.set('serviceKey', '$2a$10$FFLcKck5QPIznLD7KVsF9.8SrXglQowjj5w8P4FY0bTGwH5G.EZim');
url.searchParams.set('format', 'json');
url.searchParams.set('railOprIsttCd', 'K1');
url.searchParams.set('lnCd', '1');
url.searchParams.set('stinCd', '150'); // Is 150 a valid KORAIL code? Let's use something generic like K1, lnCd 1 or K1, lnCd K1 (Korail usually uses different codes).

fetch(url.toString())
  .then(res => res.json())
  .then(data => console.log(JSON.stringify(data.body && data.body.length ? data.body[0] : data, null, 2)))
  .catch(err => console.error(err));
