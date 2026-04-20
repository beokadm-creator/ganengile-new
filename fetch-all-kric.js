const url = new URL('https://openapi.kric.go.kr/openapi/convenientInfo/stationLocker');
url.searchParams.set('serviceKey', '$2a$10$FFLcKck5QPIznLD7KVsF9.8SrXglQowjj5w8P4FY0bTGwH5G.EZim');
url.searchParams.set('format', 'json');
url.searchParams.set('railOprIsttCd', 'S1');

fetch(url.toString())
  .then(res => res.json())
  .then(data => {
    console.log("Total count:", data.header ? data.header.resultCnt : 'unknown');
    console.log(JSON.stringify(data.body && data.body.length ? data.body.slice(0,2) : data, null, 2));
  })
  .catch(err => console.error(err));
