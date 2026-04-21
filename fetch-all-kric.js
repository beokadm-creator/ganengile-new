const url = new URL('https://openapi.kric.go.kr/openapi/convenientInfo/stationLocker');
const queryString = `?serviceKey=$2a$10$FFLcKck5QPIznLD7KVsF9.8SrXglQowjj5w8P4FY0bTGwH5G.EZim&format=json&railOprIsttCd=S1&lnCd=1&stinCd=150`;

fetch(url.origin + url.pathname + queryString)
  .then(res => res.text())
  .then(text => {
    try {
      const data = JSON.parse(text);
      console.log("Total count:", data.header ? data.header.resultCnt : 'unknown');
      console.log(JSON.stringify(data.body && data.body.length ? data.body.slice(0,2) : data, null, 2));
    } catch(e) {
      console.log("Raw text:", text);
    }
  })
  .catch(err => console.error(err));