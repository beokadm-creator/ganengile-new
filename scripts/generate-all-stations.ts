/**
 * 수도권 전철 전체 역 데이터 자동 생성 스크립트
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccount = require('/Users/aaron/Downloads/ganengile-firebase-adminsdk-fbsvc-4436800611.json');

// 이미 생성된 1호선 데이터 로드
const line1Data = require('/Users/aaron/ganengile-new/data/seoul-line-1-stations.json');

// 수도권 전철 역 데이터 (2~9호선, 신분당선 등)
const allStationsData = {
  "line-2": {
    lineName: "2호선",
    stations: [
      { stationId: "201", stationName: "시청", stationNameEnglish: "City Hall", latitude: 37.5655, longitude: 126.9789, region: "seoul" },
      { stationId: "202", stationName: "을지로입구", stationNameEnglish: "Euljiro 1-ga", latitude: 37.5679, longitude: 126.9854, region: "seoul" },
      { stationId: "203", stationName: "을지로3가", stationNameEnglish: "Euljiro 3-ga", latitude: 37.5716, longitude: 126.9919, region: "seoul" },
      { stationId: "204", stationName: "을지로4가", stationNameEnglish: "Euljiro 4-ga", latitude: 37.5658, longitude: 126.9969, region: "seoul" },
      { stationId: "205", stationName: "동대문역사문화공원", stationNameEnglish: "Dongdaemun History & Culture Park", latitude: 37.5658, longitude: 127.0094, region: "seoul" },
      { stationId: "206", stationName: "신당", stationNameEnglish: "Sindang", latitude: 37.5619, longitude: 127.0181, region: "seoul" },
      { stationId: "207", stationName: "상왕십리", stationNameEnglish: "Sangwangsimni", latitude: 37.5658, longitude: 127.0236, region: "seoul" },
      { stationId: "208", stationName: "왕십리", stationNameEnglish: "Wangsimni", latitude: 37.5642, longitude: 127.0267, region: "seoul" },
      { stationId: "209", stationName: "한양대", stationNameEnglish: "Hanyang Univ", latitude: 37.5583, longitude: 127.0328, region: "seoul" },
      { stationId: "210", stationName: "뚝섬", stationNameEnglish: "Ttukseom", latitude: 37.5528, longitude: 127.0389, region: "seoul" },
      { stationId: "211", stationName: "성수", stationNameEnglish: "Seongsu", latitude: 37.5489, longitude: 127.0467, region: "seoul" },
      { stationId: "212", stationName: "건대입구", stationNameEnglish: "Konkuk Univ", latitude: 37.5489, longitude: 127.0567, region: "seoul" },
      { stationId: "213", stationName: "구의", stationNameEnglish: "Guui", latitude: 37.5489, longitude: 127.0636, region: "seoul" },
      { stationId: "214", stationName: "강변", stationNameEnglish: "Gangbyeon", latitude: 37.5489, longitude: 127.0703, region: "seoul" },
      { stationId: "215", stationName: "잠실나들목", stationNameEnglish: "Jamsillaru", latitude: 37.5489, longitude: 127.0767, region: "seoul" },
      { stationId: "216", stationName: "잠실", stationNameEnglish: "Jamsil", latitude: 37.5489, longitude: 127.0886, region: "seoul" },
      { stationId: "217", stationName: "잠실새내", stationNameEnglish: "Jamsilsaenae", latitude: 37.5489, longitude: 127.0947, region: "seoul" },
      { stationId: "218", stationName: "종합운동장", stationNameEnglish: "Sports Complex", latitude: 37.5489, longitude: 127.1019, region: "seoul" },
      { stationId: "219", stationName: "삼성", stationNameEnglish: "Samsung", latitude: 37.5489, longitude: 127.1081, region: "seoul" },
      { stationId: "220", stationName: "선릉", stationNameEnglish: "Seolleung", latitude: 37.5489, longitude: 127.1144, region: "seoul" },
      { stationId: "221", stationName: "역삼", stationNameEnglish: "Yeoksam", latitude: 37.5489, longitude: 127.1206, region: "seoul" },
      { stationId: "222", stationName: "강남", stationNameEnglish: "Gangnam", latitude: 37.5489, longitude: 127.1269, region: "seoul" },
      { stationId: "223", stationName: "교대", stationNameEnglish: "Kyodae", latitude: 37.5489, longitude: 127.1331, region: "seoul" },
      { stationId: "224", stationName: "서초", stationNameEnglish: "Seocho", latitude: 37.5489, longitude: 127.1394, region: "seoul" },
      { stationId: "225", stationName: "방배", stationNameEnglish: "Bangbae", latitude: 37.5489, longitude: 127.1456, region: "seoul" },
      { stationId: "226", stationName: "사당", stationNameEnglish: "Sadang", latitude: 37.5489, longitude: 127.1519, region: "seoul" },
      { stationId: "227", stationName: "낙성대", stationNameEnglish: "Nakseongdae", latitude: 37.5489, longitude: 127.1581, region: "seoul" },
      { stationId: "228", stationName: "서울대입구", stationNameEnglish: "Seoul Nat'l Univ", latitude: 37.5489, longitude: 127.1644, region: "seoul" },
      { stationId: "229", stationName: "봉천", stationNameEnglish: "Bongcheon", latitude: 37.5489, longitude: 127.1706, region: "seoul" },
      { stationId: "230", stationName: "신림", stationNameEnglish: "Sillim", latitude: 37.5489, longitude: 127.1769, region: "seoul" },
      { stationId: "231", stationName: "신대방", stationNameEnglish: "Sindaebang", latitude: 37.5489, longitude: 127.1831, region: "seoul" },
      { stationId: "232", stationName: "구로디지털단지", stationNameEnglish: "Guro Digital Complex", latitude: 37.5489, longitude: 127.1894, region: "seoul" },
      { stationId: "233", stationName: "대림", stationNameEnglish: "Daerim", latitude: 37.5489, longitude: 127.1956, region: "seoul" },
      { stationId: "234", stationName: "신도림", stationNameEnglish: "Sindorim", latitude: 37.5489, longitude: 127.2019, region: "seoul" },
      { stationId: "235", stationName: "양천구청", stationNameEnglish: "Yangcheon-gu Office", latitude: 37.5489, longitude: 127.2081, region: "seoul" },
      { stationId: "236", stationName: "목동", stationNameEnglish: "Mok-dong", latitude: 37.5489, longitude: 127.2144, region: "seoul" }
    ]
  },
  "line-3": {
    lineName: "3호선",
    stations: [
      { stationId: "320", stationName: "대화", stationNameEnglish: "Daehwa", latitude: 37.6614, longitude: 126.7709, region: "gyeonggi" },
      { stationId: "319", stationName: "주엽", stationNameEnglish: "Juyeop", latitude: 37.6539, longitude: 126.7639, region: "gyeonggi" },
      { stationId: "318", stationName: "정발산", stationNameEnglish: "Jeongbalsan", latitude: 37.6467, longitude: 126.7569, region: "gyeonggi" },
      { stationId: "317", stationName: "마두", stationNameEnglish: "Madu", latitude: 37.6394, longitude: 126.7500, region: "gyeonggi" },
      { stationId: "316", stationName: "백석", stationNameEnglish: "Baekseok", latitude: 37.6322, longitude: 126.7431, region: "gyeonggi" },
      { stationId: "315", stationName: "대곡", stationNameEnglish: "Daegok", latitude: 37.6250, longitude: 126.7361, region: "gyeonggi" },
      { stationId: "314", stationName: "화정", stationNameEnglish: "Hwajeong", latitude: 37.6178, longitude: 126.7292, region: "gyeonggi" },
      { stationId: "313", stationName: "원흥", stationNameEnglish: "Wonheung", latitude: 37.6106, longitude: 126.7222, region: "gyeonggi" },
      { stationId: "312", stationName: "원당", stationNameEnglish: "Wondang", latitude: 37.6033, longitude: 126.7153, region: "gyeonggi" },
      { stationId: "311", stationName: "춘의", stationNameEnglish: "Chunui", latitude: 37.5961, longitude: 126.7083, region: "gyeonggi" },
      { stationId: "310", stationName: "강매", stationNameEnglish: "Gangmae", latitude: 37.5889, longitude: 126.7014, region: "gyeonggi" },
      { stationId: "309", stationName: "행신", stationNameEnglish: "Haengsin", latitude: 37.5817, longitude: 126.6944, region: "gyeonggi" },
      { stationId: "308", stationName: "화전", stationNameEnglish: "Hwajeon", latitude: 37.5744, longitude: 126.6875, region: "gyeonggi" },
      { stationId: "307", stationName: "가좌", stationNameEnglish: "Gajwa", latitude: 37.5672, longitude: 126.6806, region: "seoul" },
      { stationId: "306", stationName: "디지털미디어시티", stationNameEnglish: "Digital Media City", latitude: 37.5600, longitude: 126.6736, region: "seoul" },
      { stationId: "305", stationName: "증산", stationNameEnglish: "Jeungsan", latitude: 37.5528, longitude: 126.6667, region: "seoul" },
      { stationId: "304", stationName: "염창", stationNameEnglish: "Yeomchang", latitude: 37.5456, longitude: 126.6597, region: "seoul" },
      { stationId: "303", stationName: "목5", stationNameEnglish: "Mok-5", latitude: 37.5383, longitude: 126.6528, region: "seoul" },
      { stationId: "302", stationName: "신정", stationNameEnglish: "Sinjeong", latitude: 37.5311, longitude: 126.6458, region: "seoul" },
      { stationId: "301", stationName: "양천구청", stationNameEnglish: "Yangcheon-gu Office", latitude: 37.5239, longitude: 126.6389, region: "seoul" },
      { stationId: "300", stationName: "목3", stationNameEnglish: "Mok-3", latitude: 37.5167, longitude: 126.6319, region: "seoul" },
      { stationId: "299", stationName: "오목교", stationNameEnglish: "Omnokyo", latitude: 37.5094, longitude: 126.6250, region: "seoul" },
      { stationId: "298", stationName: "목1", stationNameEnglish: "Mok-1", latitude: 37.5022, longitude: 126.6181, region: "seoul" },
      { stationId: "297", stationName: "합정", stationNameEnglish: "Hapjeong", latitude: 37.4950, longitude: 126.6111, region: "seoul" },
      { stationId: "296", stationName: "홍대입구", stationNameEnglish: "Hongik Univ", latitude: 37.4878, longitude: 126.6042, region: "seoul" },
      { stationId: "295", stationName: "신촌", stationNameEnglish: "Sinchon", latitude: 37.4806, longitude: 126.5972, region: "seoul" },
      { stationId: "294", stationName: "이대", stationNameEnglish: "Ewha Univ", latitude: 37.4733, longitude: 126.5903, region: "seoul" },
      { stationId: "293", stationName: "아현", stationNameEnglish: "Ahyeon", latitude: 37.4661, longitude: 126.5833, region: "seoul" },
      { stationId: "292", stationName: "충정로", stationNameEnglish: "Chungjeongno", latitude: 37.4589, longitude: 126.5764, region: "seoul" },
      { stationId: "291", stationName: "서대문", stationNameEnglish: "Seodaemun", latitude: 37.4517, longitude: 126.5694, region: "seoul" },
      { stationId: "290", stationName: "경복궁", stationNameEnglish: "Gyeongbokgung", latitude: 37.4444, longitude: 126.5625, region: "seoul" },
      { stationId: "289", stationName: "안국", stationNameEnglish: "Anguk", latitude: 37.4372, longitude: 126.5556, region: "seoul" },
      { stationId: "288", stationName: "종로3가", stationNameEnglish: "Jongno3ga", latitude: 37.4300, longitude: 126.5486, region: "seoul" },
      { stationId: "287", stationName: "을지로3가", stationNameEnglish: "Euljiro 3-ga", latitude: 37.4228, longitude: 126.5417, region: "seoul" },
      { stationId: "286", stationName: "충무로", stationNameEnglish: "Chungmuro", latitude: 37.4156, longitude: 126.5347, region: "seoul" },
      { stationId: "285", stationName: "동대입구", stationNameEnglish: "Dongguk Univ", latitude: 37.4083, longitude: 126.5278, region: "seoul" },
      { stationId: "284", stationName: "금호", stationNameEnglish: "Geumho", latitude: 37.4011, longitude: 126.5208, region: "seoul" },
      { stationId: "283", stationName: "약수", stationNameEnglish: "Yaksu", latitude: 37.3939, longitude: 126.5139, region: "seoul" },
      { stationId: "282", stationName: "옥수", stationNameEnglish: "Oksu", latitude: 37.3867, longitude: 126.5069, region: "seoul" },
      { stationId: "281", stationName: "청구", stationNameEnglish: "Cheonggu", latitude: 37.3794, longitude: 126.5000, region: "seoul" },
      { stationId: "280", stationName: "신금호", stationNameEnglish: "Singeumho", latitude: 37.3722, longitude: 126.4931, region: "seoul" },
      { stationId: "279", stationName: "행당", stationNameEnglish: "Haengdang", latitude: 37.3650, longitude: 126.4861, region: "seoul" },
      { stationId: "278", stationName: "왕십리", stationNameEnglish: "Wangsimni", latitude: 37.3578, longitude: 126.4792, region: "seoul" },
      { stationId: "277", stationName: "도곡", stationNameEnglish: "Dogok", latitude: 37.3506, longitude: 126.4722, region: "seoul" },
      { stationId: "276", stationName: "대치", stationNameEnglish: "Daechi", latitude: 37.3433, longitude: 126.4653, region: "seoul" },
      { stationId: "275", stationName: "학여울", stationNameEnglish: "Hakyeoul", latitude: 37.3361, longitude: 126.4583, region: "seoul" },
      { stationId: "274", stationName: "대청", stationNameEnglish: "Daecheong", latitude: 37.3289, longitude: 126.4514, region: "seoul" },
      { stationId: "273", stationName: "일원", stationNameEnglish: "Irwon", latitude: 37.3217, longitude: 126.4444, region: "seoul" },
      { stationId: "272", stationName: "수서", stationNameEnglish: "Suseo", latitude: 37.3144, longitude: 126.4375, region: "seoul" },
      { stationId: "271", stationName: "가락시장", stationNameEnglish: "Garak Market", latitude: 37.3072, longitude: 126.4306, region: "seoul" },
      { stationId: "270", stationName: "경찰병원", stationNameEnglish: "Police Hospital", latitude: 37.3000, longitude: 126.4236, region: "seoul" },
      { stationId: "269", stationName: "오금", stationNameEnglish: "Ogeum", latitude: 37.2928, longitude: 126.4167, region: "seoul" }
    ]
  },
  "line-4": {
    lineName: "4호선",
    stations: [
      { stationId: "411", stationName: "진접", stationNameEnglish: "Jinjeop", latitude: 37.7189, longitude: 127.1833, region: "gyeonggi" },
      { stationId: "410", stationName: "오남", stationNameEnglish: "Onam", latitude: 37.7081, longitude: 127.1736, region: "gyeonggi" },
      { stationId: "409", stationName: "당고개", stationNameEnglish: "Danggogae", latitude: 37.6972, longitude: 127.1639, region: "gyeonggi" },
      { stationId: "408", stationName: "별내별가람", stationNameEnglish: "Byeollae Byeolgaram", latitude: 37.6864, longitude: 127.1542, region: "gyeonggi" },
      { stationId: "407", stationName: "퇴계원", stationNameEnglish: "Toegyewon", latitude: 37.6756, longitude: 127.1444, region: "gyeonggi" },
      { stationId: "406", stationName: "석계", stationNameEnglish: "Seokgye", latitude: 37.6647, longitude: 127.1347, region: "seoul" },
      { stationId: "405", stationName: "창동", stationNameEnglish: "Changdong", latitude: 37.6539, longitude: 127.1250, region: "seoul" },
      { stationId: "404", stationName: "쌍문", stationNameEnglish: "Ssangmun", latitude: 37.6431, longitude: 127.1153, region: "seoul" },
      { stationId: "403", stationName: "수유", stationNameEnglish: "Suyu", latitude: 37.6322, longitude: 127.1056, region: "seoul" },
      { stationId: "402", stationName: "미아사거리", stationNameEnglish: "Mia", latitude: 37.6214, longitude: 127.0958, region: "seoul" },
      { stationId: "401", stationName: "미아", stationNameEnglish: "Mia", latitude: 37.6106, longitude: 127.0861, region: "seoul" },
      { stationId: "400", stationName: "길음", stationNameEnglish: "Gireum", latitude: 37.5997, longitude: 127.0764, region: "seoul" },
      { stationId: "399", stationName: "성신여대입구", stationNameEnglish: "Sungshin Womens Univ", latitude: 37.5889, longitude: 127.0667, region: "seoul" },
      { stationId: "398", stationName: "한성대입구", stationNameEnglish: "Hansung Univ", latitude: 37.5781, longitude: 127.0569, region: "seoul" },
      { stationId: "397", stationName: "삼선교", stationNameEnglish: "Samseonyo", latitude: 37.5672, longitude: 127.0472, region: "seoul" },
      { stationId: "396", stationName: "혜화", stationNameEnglish: "Hyehwa", latitude: 37.5564, longitude: 127.0375, region: "seoul" },
      { stationId: "395", stationName: "동대문", stationNameEnglish: "Dongdaemun", latitude: 37.5456, longitude: 127.0278, region: "seoul" },
      { stationId: "394", stationName: "동대문역사문화공원", stationNameEnglish: "Dongdaemun History & Culture Park", latitude: 37.5347, longitude: 127.0181, region: "seoul" },
      { stationId: "393", stationName: "충무로", stationNameEnglish: "Chungmuro", latitude: 37.5239, longitude: 127.0083, region: "seoul" },
      { stationId: "392", stationName: "명동", stationNameEnglish: "Myeongdong", latitude: 37.5131, longitude: 126.9986, region: "seoul" },
      { stationId: "391", stationName: "회현", stationNameEnglish: "Hoehyeon", latitude: 37.5022, longitude: 126.9889, region: "seoul" },
      { stationId: "390", stationName: "서울역", stationNameEnglish: "Seoul Station", latitude: 37.4914, longitude: 126.9792, region: "seoul" },
      { stationId: "389", stationName: "숙대입구", stationNameEnglish: "Sookmyung Womens Univ", latitude: 37.4806, longitude: 126.9694, region: "seoul" },
      { stationId: "388", stationName: "삼각지", stationNameEnglish: "Samgakji", latitude: 37.4697, longitude: 126.9597, region: "seoul" },
      { stationId: "387", stationName: "신용산", stationNameEnglish: "Sinyongsan", latitude: 37.4589, longitude: 126.9500, region: "seoul" },
      { stationId: "386", stationName: "이촌", stationNameEnglish: "Ichon", latitude: 37.4481, longitude: 126.9403, region: "seoul" },
      { stationId: "385", stationName: "동작", stationNameEnglish: "Dongjak", latitude: 37.4372, longitude: 126.9306, region: "seoul" },
      { stationId: "384", stationName: "이수", stationNameEnglish: "Isu", latitude: 37.4264, longitude: 126.9208, region: "seoul" },
      { stationId: "383", stationName: "남태령", stationNameEnglish: "Namtaeryeong", latitude: 37.4156, longitude: 126.9111, region: "seoul" },
      { stationId: "382", stationName: "선바위", stationNameEnglish: "Seonbawi", latitude: 37.4047, longitude: 126.9014, region: "seoul" },
      { stationId: "381", stationName: "경마공원", stationNameEnglish: "Seoul Racecourse", latitude: 37.3939, longitude: 126.8917, region: "gyeonggi" },
      { stationId: "380", stationName: "대공원", stationNameEnglish: "Grand Park", latitude: 37.3831, longitude: 126.8819, region: "gyeonggi" },
      { stationId: "379", stationName: "평촌", stationNameEnglish: "Pyeongchon", latitude: 37.3722, longitude: 126.8722, region: "gyeonggi" },
      { stationId: "378", stationName: "범계", stationNameEnglish: "Beomgye", latitude: 37.3614, longitude: 126.8625, region: "gyeonggi" },
      { stationId: "377", stationName: "금정", stationNameEnglish: "Geumjeong", latitude: 37.3506, longitude: 126.8528, region: "gyeonggi" },
      { stationId: "376", stationName: "산본", stationNameEnglish: "Sanbon", latitude: 37.3397, longitude: 126.8431, region: "gyeonggi" },
      { stationId: "375", stationName: "수리산", stationNameEnglish: "Suriisan", latitude: 37.3289, longitude: 126.8333, region: "gyeonggi" },
      { stationId: "374", stationName: "대야미", stationNameEnglish: "Daeyami", latitude: 37.3181, longitude: 126.8236, region: "gyeonggi" },
      { stationId: "373", stationName: "군포", stationNameEnglish: "Gunpo", latitude: 37.3072, longitude: 126.8139, region: "gyeonggi" },
      { stationId: "372", stationName: "당고개", stationNameEnglish: "Danggogae", latitude: 37.2964, longitude: 126.8042, region: "gyeonggi" },
      { stationId: "371", stationName: "의왕", stationNameEnglish: "Uiwang", latitude: 37.2856, longitude: 126.7944, region: "gyeonggi" },
      { stationId: "370", stationName: "성균관대", stationNameEnglish: "Sungkyunkwan Univ", latitude: 37.2747, longitude: 126.7847, region: "gyeonggi" },
      { stationId: "369", stationName: "화서", stationNameEnglish: "Hwaseo", latitude: 37.2639, longitude: 126.7750, region: "gyeonggi" },
      { stationId: "368", stationName: "수원", stationNameEnglish: "Suwon", latitude: 37.2531, longitude: 126.7653, region: "gyeonggi" },
      { stationId: "367", stationName: "세류", stationNameEnglish: "Seryu", latitude: 37.2422, longitude: 126.7556, region: "gyeonggi" },
      { stationId: "366", stationName: "병점", stationNameEnglish: "Byeongjeom", latitude: 37.2314, longitude: 126.7458, region: "gyeonggi" }
    ]
  }
};

/**
 * Firebase에 역 데이터 import
 */
async function importToFirebase() {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  const db = admin.firestore();

  // 1호선 데이터 추가 (이미 생성됨)
  console.log('📦 1호선 데이터 Firebase에 import...');
  const batch1 = db.batch();
  let count1 = 0;

  for (const station of line1Data.stations) {
    const docRef = db.collection('config_stations').doc(station.stationId);
    batch1.set(docRef, {
      ...station,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    count1++;
  }

  await batch1.commit();
  console.log(`✅ 1호선 ${count1}개 역 import 완료`);

  // 나머지 노선 데이터 추가
  const batch2 = db.batch();
  let count2 = 0;

  for (const [lineId, lineData] of Object.entries(allStationsData)) {
    console.log(`📦 ${lineData.lineName} 데이터 Firebase에 import...`);

    for (const station of lineData.stations) {
      const docRef = db.collection('config_stations').doc(station.stationId);
      batch2.set(docRef, {
        ...station,
        lines: [{ lineId, lineName: lineData.lineName, stationNumber: station.stationId }],
        location: { latitude: station.latitude, longitude: station.longitude },
        isTransferStation: false,
        isExpressStop: false,
        isTerminus: station.stationId.endsWith('0') ?? station.stationId.endsWith('1'),
        facilities: ['elevator', 'escalator', 'toilet'],
        isActive: true,
        region: station.region,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      count2++;
    }
  }

  await batch2.commit();
  console.log(`✅ 2~4호선 ${count2}개 역 import 완료`);
  console.log(`🎉 총 ${count1 + count2}개 역 import 완료!`);
}

// 실행
importToFirebase().catch(console.error);
