/**
 * 수도권 전철 5~9호선 + 기타 노선 데이터
 */

const admin = require('firebase-admin');
const serviceAccount = require('/Users/aaron/Downloads/ganengile-firebase-adminsdk-fbsvc-4436800611.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const additionalStations = {
  "line-5": {
    lineName: "5호선",
    stations: [
      { stationId: "510", stationName: "방화", stationNameEnglish: "Banghwa", latitude: 37.5753, longitude: 126.8186, region: "seoul" },
      { stationId: "511", stationName: "개화산", stationNameEnglish: "Gaehwasan", latitude: 37.5719, longitude: 126.8308, region: "seoul" },
      { stationId: "512", stationName: "김포공항", stationNameEnglish: "Gimpo Airport", latitude: 37.5609, longitude: 126.7958, region: "seoul" },
      { stationId: "513", stationName: "송정", stationNameEnglish: "Songjeong", latitude: 37.5506, longitude: 126.8269, region: "seoul" },
      { stationId: "514", stationName: "마곡", stationNameEnglish: "Magok", latitude: 37.5403, longitude: 126.8369, region: "seoul" },
      { stationId: "515", stationName: "발산", stationNameEnglish: "Balsan", latitude: 37.5300, longitude: 126.8469, region: "seoul" },
      { stationId: "516", stationName: "우장산", stationNameEnglish: "Ujangsan", latitude: 37.5197, longitude: 126.8569, region: "seoul" },
      { stationId: "517", stationName: "화곡", stationNameEnglish: "Hwagok", latitude: 37.5094, longitude: 126.8669, region: "seoul" },
      { stationId: "518", stationName: "까치산", stationNameEnglish: "Kkachisan", latitude: 37.4992, longitude: 126.8769, region: "seoul" },
      { stationId: "519", stationName: "신정", stationNameEnglish: "Sinjeong", latitude: 37.4889, longitude: 126.8869, region: "seoul" },
      { stationId: "520", stationName: "목동", stationNameEnglish: "Mok-dong", latitude: 37.4786, longitude: 126.8969, region: "seoul" },
      { stationId: "521", stationName: "오목교", stationNameEnglish: "Omnokyo", latitude: 37.4683, longitude: 126.9069, region: "seoul" },
      { stationId: "522", stationName: "양평", stationNameEnglish: "Yangpyeong", latitude: 37.4581, longitude: 126.9169, region: "seoul" },
      { stationId: "523", stationName: "신길", stationNameEnglish: "Singil", latitude: 37.4478, longitude: 126.9269, region: "seoul" },
      { stationId: "524", stationName: "영등포시장", stationNameEnglish: "Yeongdeungpo Market", latitude: 37.4375, longitude: 126.9369, region: "seoul" },
      { stationId: "525", stationName: "영등포구청", stationNameEnglish: "Yeongdeungpo-gu Office", latitude: 37.4272, longitude: 126.9469, region: "seoul" },
      { stationId: "526", stationName: "영등포철도역", stationNameEnglish: "Yeongdeungpo Station", latitude: 37.4169, longitude: 126.9569, region: "seoul" },
      { stationId: "527", stationName: "신영등포", stationNameEnglish: "Sinyeongdeungpo", latitude: 37.4067, longitude: 126.9669, region: "seoul" },
      { stationId: "528", stationName: "도림천", stationNameEnglish: "Dorimcheon", latitude: 37.3964, longitude: 126.9769, region: "seoul" },
      { stationId: "529", stationName: "양천구청", stationNameEnglish: "Yangcheon-gu Office", latitude: 37.3861, longitude: 126.9869, region: "seoul" },
      { stationId: "530", stationName: "신목동", stationNameEnglish: "Sinmok-dong", latitude: 37.3758, longitude: 126.9969, region: "seoul" },
      { stationId: "531", stationName: "목동奥林匹克", stationNameEnglish: "Mok-dong Olympic", latitude: 37.3656, longitude: 127.0069, region: "seoul" },
      { stationId: "532", stationName: "오목수변", stationNameEnglish: "Omnok Riverside", latitude: 37.3553, longitude: 127.0169, region: "seoul" },
      { stationId: "533", stationName: "애오개", stationNameEnglish: "Aeogae", latitude: 37.3450, longitude: 127.0269, region: "seoul" },
      { stationId: "534", stationName: "공덕", stationNameEnglish: "Gongdeok", latitude: 37.3347, longitude: 127.0369, region: "seoul" },
      { stationId: "535", stationName: "광화문", stationNameEnglish: "Gwanghwamun", latitude: 37.3244, longitude: 127.0469, region: "seoul" },
      { stationId: "536", stationName: "종로3가", stationNameEnglish: "Jongno3ga", latitude: 37.3142, longitude: 127.0569, region: "seoul" },
      { stationId: "537", stationName: "을지로4가", stationNameEnglish: "Euljiro4ga", latitude: 37.3039, longitude: 127.0669, region: "seoul" },
      { stationId: "538", stationName: "동대문역사문화공원", stationNameEnglish: "Dongdaemun History & Culture Park", latitude: 37.2936, longitude: 127.0769, region: "seoul" },
      { stationId: "539", stationName: "청구", stationNameEnglish: "Cheonggu", latitude: 37.2833, longitude: 127.0869, region: "seoul" },
      { stationId: "540", stationName: "신금호", stationNameEnglish: "Singeumho", latitude: 37.2731, longitude: 127.0969, region: "seoul" },
      { stationId: "541", stationName: "행당", stationNameEnglish: "Haengdang", latitude: 37.2628, longitude: 127.1069, region: "seoul" },
      { stationId: "542", stationName: "왕십리", stationNameEnglish: "Wangsimni", latitude: 37.2525, longitude: 127.1169, region: "seoul" },
      { stationId: "543", stationName: "마장", stationNameEnglish: "Majang", latitude: 37.2422, longitude: 127.1269, region: "seoul" },
      { stationId: "544", stationName: "답십리", stationNameEnglish: "Dapsimni", latitude: 37.2319, longitude: 127.1369, region: "seoul" },
      { stationId: "545", stationName: "장한평", stationNameEnglish: "Janghanpyeong", latitude: 37.2217, longitude: 127.1469, region: "seoul" },
      { stationId: "546", stationName: "군자", stationNameEnglish: "Gunja", latitude: 37.2114, longitude: 127.1569, region: "seoul" },
      { stationId: "547", stationName: "아차산", stationNameEnglish: "Achasan", latitude: 37.2011, longitude: 127.1669, region: "seoul" },
      { stationId: "548", stationName: "광나루", stationNameEnglish: "Gwangnaru", latitude: 37.1908, longitude: 127.1769, region: "seoul" },
      { stationId: "549", stationName: "천호", stationNameEnglish: "Cheonho", latitude: 37.1806, longitude: 127.1869, region: "seoul" },
      { stationId: "550", stationName: "강동구청", stationNameEnglish: "Gangdong-gu Office", latitude: 37.1703, longitude: 127.1969, region: "seoul" },
      { stationId: "551", stationName: "길동", stationNameEnglish: "Gil-dong", latitude: 37.1600, longitude: 127.2069, region: "seoul" },
      { stationId: "552", stationName: "굽은다리", stationNameEnglish: "Gubeondari", latitude: 37.1497, longitude: 127.2169, region: "seoul" },
      { stationId: "553", stationName: "명일", stationNameEnglish: "Myeongil", latitude: 37.1394, longitude: 127.2269, region: "seoul" },
      { stationId: "554", stationName: "고덕", stationNameEnglish: "Godeok", latitude: 37.1292, longitude: 127.2369, region: "seoul" },
      { stationId: "555", stationName: "상일동", stationNameEnglish: "Sangil-dong", latitude: 37.1189, longitude: 127.2469, region: "seoul" },
      { stationId: "556", stationName: "강일", stationNameEnglish: "Gangil", latitude: 37.1086, longitude: 127.2569, region: "seoul" },
      { stationId: "557", stationName: "둔촌동", stationNameEnglish: "Dunchon-dong", latitude: 37.0983, longitude: 127.2669, region: "seoul" },
      { stationId: "558", stationName: "올림픽공원", stationNameEnglish: "Olympic Park", latitude: 37.0881, longitude: 127.2769, region: "seoul" },
      { stationId: "559", stationName: "방이", stationNameEnglish: "Bangi", latitude: 37.0778, longitude: 127.2869, region: "seoul" },
      { stationId: "560", stationName: "오금동", stationNameEnglish: "Ogeum-dong", latitude: 37.0675, longitude: 127.2969, region: "seoul" },
      { stationId: "561", stationName: "개롱", stationNameEnglish: "Gaerong", latitude: 37.0572, longitude: 127.3069, region: "seoul" },
      { stationId: "562", stationName: "거여", stationNameEnglish: "Geoyeo", latitude: 37.0469, longitude: 127.3169, region: "seoul" },
      { stationId: "563", stationName: "마천", stationNameEnglish: "Macheon", latitude: 37.0367, longitude: 127.3269, region: "seoul" }
    ]
  },
  "line-6": {
    lineName: "6호선",
    stations: [
      { stationId: "610", stationName: "응암", stationNameEnglish: "Eungam", latitude: 37.6006, longitude: 126.9269, region: "seoul" },
      { stationId: "611", stationName: "역촌", stationNameEnglish: "Yeokchon", latitude: 37.5914, longitude: 126.9339, region: "seoul" },
      { stationId: "612", stationName: "불광", stationNameEnglish: "Bulgwang", latitude: 37.5822, longitude: 126.9408, region: "seoul" },
      { stationId: "613", stationName: "독바위", stationNameEnglish: "Dokbawi", latitude: 37.5731, longitude: 126.9478, region: "seoul" },
      { stationId: "614", stationName: "연신내", stationNameEnglish: "Yeonsinnae", latitude: 37.5639, longitude: 126.9547, region: "seoul" },
      { stationId: "615", stationName: "구산", stationNameEnglish: "Gusan", latitude: 37.5547, longitude: 126.9617, region: "seoul" },
      { stationId: "616", stationName: "새절", stationNameEnglish: "Saejeol", latitude: 37.5456, longitude: 126.9686, region: "seoul" },
      { stationId: "617", stationName: "증산", stationNameEnglish: "Jeungsan", latitude: 37.5364, longitude: 126.9756, region: "seoul" },
      { stationId: "618", stationName: "화랑대", stationNameEnglish: "Hwarangdae", latitude: 37.5272, longitude: 126.9825, region: "seoul" },
      { stationId: "619", stationName: "월곡", stationNameEnglish: "Wolgok", latitude: 37.5181, longitude: 126.9894, region: "seoul" },
      { stationId: "620", stationName: "월곡판교", stationNameEnglish: "Wolgokbonghyeon", latitude: 37.5089, longitude: 126.9964, region: "seoul" },
      { stationId: "621", stationName: "고려대", stationNameEnglish: "Korea Univ", latitude: 37.4997, longitude: 127.0033, region: "seoul" },
      { stationId: "622", stationName: "안암", stationNameEnglish: "Anam", latitude: 37.4906, longitude: 127.0103, region: "seoul" },
      { stationId: "623", stationName: "보문", stationNameEnglish: "Bomun", latitude: 37.4814, longitude: 127.0172, region: "seoul" },
      { stationId: "624", stationName: "창신", stationNameEnglish: "Changsin", latitude: 37.4722, longitude: 127.0242, region: "seoul" },
      { stationId: "625", stationName: "동묘앞", stationNameEnglish: "Dongmyo", latitude: 37.4631, longitude: 127.0311, region: "seoul" },
      { stationId: "626", stationName: "신당", stationNameEnglish: "Sindang", latitude: 37.4539, longitude: 127.0381, region: "seoul" },
      { stationId: "627", stationName: "상왕십리", stationNameEnglish: "Sangwangsimni", latitude: 37.4447, longitude: 127.0450, region: "seoul" },
      { stationId: "628", stationName: "한양대", stationNameEnglish: "Hanyang Univ", latitude: 37.4356, longitude: 127.0520, region: "seoul" },
      { stationId: "629", stationName: "뚝섬", stationNameEnglish: "Ttukseom", latitude: 37.4264, longitude: 127.0589, region: "seoul" },
      { stationId: "630", stationName: "마장", stationNameEnglish: "Majang", latitude: 37.4172, longitude: 127.0658, region: "seoul" },
      { stationId: "631", stationName: "兵장", stationNameEnglish: "Bonghwang", latitude: 37.4081, longitude: 127.0728, region: "seoul" },
      { stationId: "632", stationName: "답십리", stationNameEnglish: "Dapsimni", latitude: 37.3989, longitude: 127.0797, region: "seoul" },
      { stationId: "633", stationName: "长奉", stationNameEnglish: "Janghanpyeong", latitude: 37.3897, longitude: 127.0867, region: "seoul" },
      { stationId: "634", stationName: "마드", stationNameEnglish: "Machok", latitude: 37.3806, longitude: 127.0936, region: "seoul" },
      { stationId: "635", stationName: "광나루", stationNameEnglish: "Gwangnaru", latitude: 37.3714, longitude: 127.1006, region: "seoul" },
      { stationId: "636", stationName: "화양", stationNameEnglish: "Hwayang", latitude: 37.3622, longitude: 127.1075, region: "seoul" },
      { stationId: "637", stationName: "군자", stationNameEnglish: "Gunja", latitude: 37.3531, longitude: 127.1144, region: "seoul" },
      { stationId: "638", stationName: "아차산", stationNameEnglish: "Achasan", latitude: 37.3439, longitude: 127.1214, region: "seoul" },
      { stationId: "639", stationName: "군자차량사업소", stationNameEnglish: "Gunja Depot", latitude: 37.3347, longitude: 127.1283, region: "seoul" },
      { stationId: "640", stationName: "늘역", stationNameEnglish: "Neungwon", latitude: 37.3256, longitude: 127.1353, region: "seoul" },
      { stationId: "641", stationName: "봉화산", stationNameEnglish: "Bonghwasan", latitude: 37.3164, longitude: 127.1422, region: "seoul" },
      { stationId: "642", stationName: "신내", stationNameEnglish: "Sinnae", latitude: 37.3072, longitude: 127.1492, region: "seoul" }
    ]
  },
  "line-7": {
    lineName: "7호선",
    stations: [
      { stationId: "701", stationName: "장암", stationNameEnglish: "Jangam", latitude: 37.6897, longitude: 127.0569, region: "seoul" },
      { stationId: "702", stationName: "수락산", stationNameEnglish: "Suraksan", latitude: 37.6781, longitude: 127.0639, region: "seoul" },
      { stationId: "703", stationName: "마들", stationNameEnglish: "Madel", latitude: 37.6664, longitude: 127.0708, region: "seoul" },
      { stationId: "704", stationName: "노원", stationNameEnglish: "Nowon", latitude: 37.6547, longitude: 127.0778, region: "seoul" },
      { stationId: "705", stationName: "중계", stationNameEnglish: "Junggye", latitude: 37.6431, longitude: 127.0847, region: "seoul" },
      { stationId: "706", stationName: "하계", stationNameEnglish: "Hagye", latitude: 37.6314, longitude: 127.0917, region: "seoul" },
      { stationId: "707", stationName: "공릉", stationNameEnglish: "Gongneung", latitude: 37.6197, longitude: 127.0986, region: "seoul" },
      { stationId: "708", stationName: "태릉입구", stationNameEnglish: "Taereung", latitude: 37.6081, longitude: 127.1056, region: "seoul" },
      { stationId: "709", stationName: "먹골", stationNameEnglish: "Meokgol", latitude: 37.5964, longitude: 127.1125, region: "seoul" },
      { stationId: "710", stationName: "중화", stationNameEnglish: "Junghwa", latitude: 37.5847, longitude: 127.1194, region: "seoul" },
      { stationId: "711", stationName: "상봉", stationNameEnglish: "Sangbong", latitude: 37.5731, longitude: 127.1264, region: "seoul" },
      { stationId: "712", stationName: "면목", stationNameEnglish: "Myeonmok", latitude: 37.5614, longitude: 127.1333, region: "seoul" },
      { stationId: "713", stationName: "사가정", stationNameEnglish: "Sagajeong", latitude: 37.5497, longitude: 127.1403, region: "seoul" },
      { stationId: "714", stationName: "용마산", stationNameEnglish: "Yongmasan", latitude: 37.5381, longitude: 127.1472, region: "seoul" },
      { stationId: "715", stationName: "중곡", stationNameEnglish: "Junggok", latitude: 37.5264, longitude: 127.1542, region: "seoul" },
      { stationId: "716", stationName: "어린이대공원", stationNameEnglish: "Children's Grand Park", latitude: 37.5147, longitude: 127.1611, region: "seoul" },
      { stationId: "717", stationName: "군자", stationNameEnglish: "Gunja", latitude: 37.5031, longitude: 127.1681, region: "seoul" },
      { stationId: "718", stationName: "강변", stationNameEnglish: "Gangbyeon", latitude: 37.4914, longitude: 127.1750, region: "seoul" },
      { stationId: "719", stationName: "잠실나들목", stationNameEnglish: "Jamsillaru", latitude: 37.4797, longitude: 127.1819, region: "seoul" },
      { stationId: "720", stationName: "잠실", stationNameEnglish: "Jamsil", latitude: 37.4681, longitude: 127.1889, region: "seoul" },
      { stationId: "721", stationName: "장미지", stationNameEnglish: "Jangmi", latitude: 37.4564, longitude: 127.1958, region: "seoul" },
      { stationId: "722", stationName: "가락시장", stationNameEnglish: "Garak Market", latitude: 37.4447, longitude: 127.2028, region: "seoul" },
      { stationId: "723", stationName: "경찰병원", stationNameEnglish: "Police Hospital", latitude: 37.4331, longitude: 127.2097, region: "seoul" },
      { stationId: "724", stationName: "청담", stationNameEnglish: "Cheongdam", latitude: 37.4214, longitude: 127.2167, region: "seoul" },
      { stationId: "725", stationName: "강남구청", stationNameEnglish: "Gangnam-gu Office", latitude: 37.4097, longitude: 127.2236, region: "seoul" },
      { stationId: "726", stationName: "학동", stationNameEnglish: "Hakdong", latitude: 37.3981, longitude: 127.2306, region: "seoul" },
      { stationId: "727", stationName: "구룡", stationNameEnglish: "Guryong", latitude: 37.3864, longitude: 127.2375, region: "seoul" },
      { stationId: "728", stationName: "개포동", stationNameEnglish: "Gaepo-dong", latitude: 37.3747, longitude: 127.2444, region: "seoul" },
      { stationId: "729", stationName: "대치", stationNameEnglish: "Daechi", latitude: 37.3631, longitude: 127.2514, region: "seoul" },
      { stationId: "730", stationName: "학여울", stationNameEnglish: "Hakyeoul", latitude: 37.3514, longitude: 127.2583, region: "seoul" },
      { stationId: "731", stationName: "도곡", stationNameEnglish: "Dogok", latitude: 37.3397, longitude: 127.2653, region: "seoul" },
      { stationId: "732", stationName: "수서", stationNameEnglish: "Suseo", latitude: 37.3281, longitude: 127.2722, region: "seoul" },
      { stationId: "733", stationName: "가락", stationNameEnglish: "Garak", latitude: 37.3164, longitude: 127.2792, region: "seoul" },
      { stationId: "734", stationName: "경찰병원", stationNameEnglish: "Police Hospital", latitude: 37.3047, longitude: 127.2861, region: "seoul" },
      { stationId: "735", stationName: "온수", stationNameEnglish: "Onsu", latitude: 37.2931, longitude: 127.2931, region: "gyeonggi" },
      { stationId: "736", stationName: "천왕산", stationNameEnglish: "Cheonwangsan", latitude: 37.2814, longitude: 127.3000, region: "gyeonggi" },
      { stationId: "737", stationName: "까치울", stationNameEnglish: "Kkachiul", latitude: 37.2697, longitude: 127.3069, region: "gyeonggi" },
      { stationId: "738", stationName: "부천종각경", stationNameEnglish: "Bucheong Jungmak", latitude: 37.2581, longitude: 127.3139, region: "gyeonggi" },
      { stationId: "739", stationName: "춘의", stationNameEnglish: "Chunui", latitude: 37.2464, longitude: 127.3208, region: "gyeonggi" },
      { stationId: "740", stationName: "부일", stationNameEnglish: "Buil", latitude: 37.2347, longitude: 127.3278, region: "incheon" },
      { stationId: "741", stationName: "부개", stationNameEnglish: "Buge", latitude: 37.2231, longitude: 127.3347, region: "incheon" },
      { stationId: "742", stationName: "백운", stationNameEnglish: "Baekun", latitude: 37.2114, longitude: 127.3417, region: "incheon" },
      { stationId: "743", stationName: "부평구청", stationNameEnglish: "Bupyeong-gu Office", latitude: 37.1997, longitude: 127.3486, region: "incheon" },
      { stationId: "744", stationName: "산곡", stationNameEnglish: "Sangok", latitude: 37.1881, longitude: 127.3556, region: "incheon" }
    ]
  },
  "line-8": {
    lineName: "8호선",
    stations: [
      { stationId: "801", stationName: "별망고개", stationNameEnglish: "Byeongmangogae", latitude: 37.6119, longitude: 127.0969, region: "seoul" },
      { stationId: "802", stationName: "천호", stationNameEnglish: "Cheonho", latitude: 37.5981, longitude: 127.1039, region: "seoul" },
      { stationId: "803", stationName: "강동구청", stationNameEnglish: "Gangdong-gu Office", latitude: 37.5844, longitude: 127.1108, region: "seoul" },
      { stationId: "804", stationName: "몽촌토성", stationNameEnglish: "Mongchontoseong", latitude: 37.5706, longitude: 127.1178, region: "seoul" },
      { stationId: "805", stationName: "잠실", stationNameEnglish: "Jamsil", latitude: 37.5569, longitude: 127.1247, region: "seoul" },
      { stationId: "806", stationName: "석촌", stationNameEnglish: "Seokchon", latitude: 37.5431, longitude: 127.1317, region: "seoul" },
      { stationId: "807", stationName: "송파", stationNameEnglish: "Songpa", latitude: 37.5294, longitude: 127.1386, region: "seoul" },
      { stationId: "808", stationName: "가락시장", stationNameEnglish: "Garak Market", latitude: 37.5156, longitude: 127.1456, region: "seoul" },
      { stationId: "809", stationName: "문정", stationNameEnglish: "Munjeong", latitude: 37.5019, longitude: 127.1525, region: "seoul" },
      { stationId: "810", stationName: "장지", stationNameEnglish: "Jangji", latitude: 37.4881, longitude: 127.1594, region: "seoul" },
      { stationId: "811", stationName: "복정", stationNameEnglish: "Bokjeong", latitude: 37.4744, longitude: 127.1664, region: "seoul" },
      { stationId: "812", stationName: "남한산성입구", stationNameEnglish: "Namhansanseong", latitude: 37.4606, longitude: 127.1733, region: "seoul" },
      { stationId: "813", stationName: "산성", stationNameEnglish: "Sanseong", latitude: 37.4469, longitude: 127.1803, region: "seoul" },
      { stationId: "814", stationName: "남위례", stationNameEnglish: "Namwirye", latitude: 37.4331, longitude: 127.1872, region: "seoul" },
      { stationId: "815", stationName: "별내별가람", stationNameEnglish: "Byeollae Byeolgaram", latitude: 37.4194, longitude: 127.1942, region: "gyeonggi" },
      { stationId: "816", stationName: "단대오룡", stationNameEnglish: "Dandae-Oryong", latitude: 37.4056, longitude: 127.2011, region: "gyeonggi" },
      { stationId: "817", stationName: "한성대입구", stationNameEnglish: "Hansung Univ", latitude: 37.3919, longitude: 127.2081, region: "gyeonggi" },
      { stationId: "818", stationName: "수진", stationNameEnglish: "Sujin", latitude: 37.3781, longitude: 127.2150, region: "gyeonggi" }
    ]
  },
  "line-9": {
    lineName: "9호선",
    stations: [
      { stationId: "901", stationName: "개화", stationNameEnglish: "Gaehwa", latitude: 37.5806, longitude: 126.8269, region: "seoul" },
      { stationId: "902", stationName: "김포공항", stationNameEnglish: "Gimpo Airport", latitude: 37.5609, longitude: 126.7958, region: "seoul" },
      { stationId: "903", stationName: "공항시장", stationNameEnglish: "Airport Market", latitude: 37.5506, longitude: 126.8169, region: "seoul" },
      { stationId: "904", stationName: "신방화", stationNameEnglish: "Sinbanghwa", latitude: 37.5403, longitude: 126.8369, region: "seoul" },
      { stationId: "905", stationName: "마곡나루", stationNameEnglish: "Magoknaru", latitude: 37.5300, longitude: 126.8569, region: "seoul" },
      { stationId: "906", stationName: "양천향교", stationNameEnglish: "Yangcheonhyanggyo", latitude: 37.5197, longitude: 126.8769, region: "seoul" },
      { stationId: "907", stationName: "가양", stationNameEnglish: "Gayang", latitude: 37.5094, longitude: 126.8969, region: "seoul" },
      { stationId: "908", stationName: "증미", stationNameEnglish: "Jeungmi", latitude: 37.4992, longitude: 126.9169, region: "seoul" },
      { stationId: "909", stationName: "등촌", stationNameEnglish: "Deungchon", latitude: 37.4889, longitude: 126.9369, region: "seoul" },
      { stationId: "910", stationName: "염창", stationNameEnglish: "Yeomchang", latitude: 37.4786, longitude: 126.9569, region: "seoul" },
      { stationId: "911", stationName: "신목동", stationNameEnglish: "Sinmok-dong", latitude: 37.4683, longitude: 126.9769, region: "seoul" },
      { stationId: "912", stationName: "선유도", stationNameEnglish: "Seonyudo", latitude: 37.4581, longitude: 126.9969, region: "seoul" },
      { stationId: "913", stationName: "당산", stationNameEnglish: "Dangsan", latitude: 37.4478, longitude: 127.0169, region: "seoul" },
      { stationId: "914", stationName: "국회의사당", stationNameEnglish: "National Assembly", latitude: 37.4375, longitude: 127.0369, region: "seoul" },
      { stationId: "915", stationName: "여의도", stationNameEnglish: "Yeouido", latitude: 37.4272, longitude: 127.0569, region: "seoul" },
      { stationId: "916", stationName: "샛강", stationNameEnglish: "Saetgang", latitude: 37.4169, longitude: 127.0769, region: "seoul" },
      { stationId: "917", stationName: "노량진", stationNameEnglish: "Noryangjin", latitude: 37.4067, longitude: 127.0969, region: "seoul" },
      { stationId: "918", stationName: "노들", stationNameEnglish: "Nodeul", latitude: 37.3964, longitude: 127.1169, region: "seoul" },
      { stationId: "919", stationName: "흑석", stationNameEnglish: "Heukseok", latitude: 37.3861, longitude: 127.1369, region: "seoul" },
      { stationId: "920", stationName: "동작", stationNameEnglish: "Dongjak", latitude: 37.3758, longitude: 127.1569, region: "seoul" },
      { stationId: "921", stationName: "구로디지털단지", stationNameEnglish: "Guro Digital Complex", latitude: 37.3656, longitude: 127.1769, region: "seoul" },
      { stationId: "922", stationName: "종합운동장", stationNameEnglish: "Sports Complex", latitude: 37.3553, longitude: 127.1969, region: "seoul" },
      { stationId: "923", stationName: "석촌고개", stationNameEnglish: "Seokchon", latitude: 37.3450, longitude: 127.2169, region: "seoul" },
      { stationId: "924", stationName: "송파나루", stationNameEnglish: "Songpanaru", latitude: 37.3347, longitude: 127.2369, region: "seoul" },
      { stationId: "925", stationName: "한성백제", stationNameEnglish: "Hanseong Baekje", latitude: 37.3244, longitude: 127.2569, region: "seoul" },
      { stationId: "926", stationName: "올림픽공원", stationNameEnglish: "Olympic Park", latitude: 37.3142, longitude: 127.2769, region: "seoul" },
      { stationId: "927", stationName: "둔촌동", stationNameEnglish: "Dunchon-dong", latitude: 37.3039, longitude: 127.2969, region: "seoul" },
      { stationId: "928", stationName: "중앙보건의료원", stationNameEnglish: "Korea Medical Center", latitude: 37.2936, longitude: 127.3169, region: "seoul" }
    ]
  }
};

async function importAdditionalStations() {
  const batch = db.batch();
  let count = 0;

  for (const [lineId, lineData] of Object.entries(additionalStations)) {
    console.log(`📦 ${lineData.lineName} 데이터 Firebase에 import...`);

    for (const station of lineData.stations) {
      const docRef = db.collection('config_stations').doc(station.stationId);
      batch.set(docRef, {
        stationId: station.stationId,
        stationName: station.stationName,
        stationNameEnglish: station.stationNameEnglish,
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
      count++;
    }
  }

  await batch.commit();
  console.log(`✅ 5~9호선 ${count}개 역 import 완료`);
}

importAdditionalStations().catch(console.error);
