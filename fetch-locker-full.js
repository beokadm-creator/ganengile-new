const url = new URL('https://openapi.kric.go.kr/openapi/convenientInfo/stationLocker');
url.searchParams.set('serviceKey', '$2a$10$FFLcKck5QPIznLD7KVsF9.8SrXglQowjj5w8P4FY0bTGwH5G.EZim');
url.searchParams.set('format', 'json');
url.searchParams.set('railOprIsttCd', 'S1');
url.searchParams.set('lnCd', '1');
url.searchParams.set('stinCd', '150');

fetch(url.toString())
  .then(res => res.json())
  .then(data => console.log(JSON.stringify(data.body[0], null, 2)))
  .catch(err => console.error(err));
