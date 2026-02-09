/**
 * 수도권 전철 기타 노선 데이터 (신분당선, 경의중앙선, 수인분당선, 공항철도, 경춘선)
 */

const admin = require('firebase-admin');
const serviceAccount = require('/Users/aaron/Downloads/ganengile-firebase-adminsdk-fbsvc-4436800611.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const otherStations = {
  "line-shinbundang": {
    lineName: "신분당선",
    stations: [
      { stationId: "D01", stationName: "신사", stationNameEnglish: "Sinsa", latitude: 37.5172, longitude: 127.0239, region: "seoul" },
      { stationId: "D02", stationName: "논현", stationNameEnglish: "Nonhyeon", latitude: 37.5106, longitude: 127.0339, region: "seoul" },
      { stationId: "D03", stationName: "강남", stationNameEnglish: "Gangnam", latitude: 37.5042, longitude: 127.0439, region: "seoul" },
      { stationId: "D04", stationName: "양재", stationNameEnglish: "Yangjae", latitude: 37.4978, longitude: 127.0539, region: "seoul" },
      { stationId: "D05", stationName: "양재시민의숲", stationNameEnglish: "Yangjae Citizen's Forest", latitude: 37.4914, longitude: 127.0639, region: "seoul" },
      { stationId: "D06", stationName: "청계산입구", stationNameEnglish: "Cheonggyesan", latitude: 37.4850, longitude: 127.0739, region: "gyeonggi" },
      { stationId: "D07", stationName: "판교", stationNameEnglish: "Pangyo", latitude: 37.4786, longitude: 127.0839, region: "gyeonggi" },
      { stationId: "D08", stationName: "정자", stationNameEnglish: "Jeongja", latitude: 37.3797, longitude: 127.1081, region: "gyeonggi" },
      { stationId: "D09", stationName: "역삼", stationNameEnglish: "Yeoksam", latitude: 37.5036, longitude: 127.0439, region: "gyeonggi" },
      { stationId: "D10", stationName: "선릉", stationNameEnglish: "Seolleung", latitude: 37.5006, longitude: 127.0739, region: "gyeonggi" },
      { stationId: "D11", stationName: "한티", stationNameEnglish: "Hanti", latitude: 37.4942, longitude: 127.0939, region: "gyeonggi" },
      { stationId: "D12", stationName: "도곡", stationNameEnglish: "Dogok", latitude: 37.4878, longitude: 127.1039, region: "gyeonggi" },
      { stationId: "D13", stationName: "수서", stationNameEnglish: "Suseo", latitude: 37.4814, longitude: 127.1139, region: "seoul" },
      { stationId: "D14", stationName: "복정", stationNameEnglish: "Bokjeong", latitude: 37.4750, longitude: 127.1239, region: "seoul" }
    ]
  },
  "line-gyeongui": {
    lineName: "경의중앙선",
    stations: [
      { stationId: "K301", stationName: "문산", stationNameEnglish: "Munsan", latitude: 37.8819, longitude: 126.8231, region: "gyeonggi" },
      { stationId: "K302", stationName: "파주", stationNameEnglish: "Paju", latitude: 37.8719, longitude: 126.8331, region: "gyeonggi" },
      { stationId: "K303", stationName: "금릉", stationNameEnglish: "Geumneung", latitude: 37.8619, longitude: 126.8431, region: "gyeonggi" },
      { stationId: "K304", stationName: "금촌", stationNameEnglish: "Geumchon", latitude: 37.8519, longitude: 126.8531, region: "gyeonggi" },
      { stationId: "K305", stationName: "운정", stationNameEnglish: "Unjeong", latitude: 37.8419, longitude: 126.8631, region: "gyeonggi" },
      { stationId: "K306", stationName: "야당", stationNameEnglish: "Yadang", latitude: 37.8319, longitude: 126.8731, region: "gyeonggi" },
      { stationId: "K307", stationName: "탄현", stationNameEnglish: "Tanhyeon", latitude: 37.8219, longitude: 126.8831, region: "gyeonggi" },
      { stationId: "K308", stationName: "일산", stationNameEnglish: "Ilsan", latitude: 37.6578, longitude: 127.0717, region: "gyeonggi" },
      { stationId: "K309", stationName: "풍산", stationNameEnglish: "Pungsan", latitude: 37.6495, longitude: 127.0756, region: "gyeonggi" },
      { stationId: "K310", stationName: "백석", stationNameEnglish: "Baekseok", latitude: 37.6414, longitude: 127.0794, region: "gyeonggi" },
      { stationId: "K311", stationName: "대곡", stationNameEnglish: "Daegok", latitude: 37.6331, longitude: 127.0833, region: "gyeonggi" },
      { stationId: "K312", stationName: "화정", stationNameEnglish: "Hwajeong", latitude: 37.6247, longitude: 127.0872, region: "gyeonggi" },
      { stationId: "K313", stationName: "원흥", stationNameEnglish: "Wonheung", latitude: 37.6164, longitude: 127.0911, region: "gyeonggi" },
      { stationId: "K314", stationName: "능곡", stationNameEnglish: "Neunggok", latitude: 37.6081, longitude: 127.0950, region: "gyeonggi" },
      { stationId: "K315", stationName: "행신", stationNameEnglish: "Haengsin", latitude: 37.5997, longitude: 127.0989, region: "gyeonggi" },
      { stationId: "K316", stationName: "강매", stationNameEnglish: "Gangmae", latitude: 37.5914, longitude: 127.1028, region: "gyeonggi" },
      { stationId: "K317", stationName: "화전", stationNameEnglish: "Hwajeon", latitude: 37.5831, longitude: 127.1067, region: "gyeonggi" },
      { stationId: "K318", stationName: "가좌", stationNameEnglish: "Gajwa", latitude: 37.5747, longitude: 127.1106, region: "seoul" },
      { stationId: "K319", stationName: "디지털미디어시티", stationNameEnglish: "Digital Media City", latitude: 37.5664, longitude: 127.1144, region: "seoul" },
      { stationId: "K320", stationName: "수색", stationNameEnglish: "Susaek", latitude: 37.5581, longitude: 127.1183, region: "seoul" },
      { stationId: "K321", stationName: "신창", stationNameEnglish: "Sinchang", latitude: 37.5497, longitude: 127.1222, region: "seoul" },
      { stationId: "K322", stationName: "홍대입구", stationNameEnglish: "Hongik Univ", latitude: 37.5414, longitude: 127.1261, region: "seoul" },
      { stationId: "K323", stationName: "신촌", stationNameEnglish: "Sinchon", latitude: 37.5331, longitude: 127.1300, region: "seoul" },
      { stationId: "K324", stationName: "공덕", stationNameEnglish: "Gongdeok", latitude: 37.5247, longitude: 127.1339, region: "seoul" },
      { stationId: "K325", stationName: "서강대", stationNameEnglish: "Sogang Univ", latitude: 37.5164, longitude: 127.1378, region: "seoul" },
      { stationId: "K326", stationName: "효창공원", stationNameEnglish: "Hyochang", latitude: 37.5081, longitude: 127.1417, region: "seoul" },
      { stationId: "K327", stationName: "이촌", stationNameEnglish: "Ichon", latitude: 37.4997, longitude: 127.1456, region: "seoul" },
      { stationId: "K328", stationName: "용산", stationNameEnglish: "Yongsan", latitude: 37.4914, longitude: 127.1494, region: "seoul" },
      { stationId: "K329", stationName: "노량진", stationNameEnglish: "Noryangjin", latitude: 37.4831, longitude: 127.1533, region: "seoul" },
      { stationId: "K330", stationName: " 효창", stationNameEnglish: "Hyochang", latitude: 37.4747, longitude: 127.1572, region: "seoul" },
      { stationId: "K331", stationName: "공덕", stationNameEnglish: "Gongdeok", latitude: 37.4664, longitude: 127.1611, region: "seoul" },
      { stationId: "K332", stationName: "서울역", stationNameEnglish: "Seoul Station", latitude: 37.4581, longitude: 127.1650, region: "seoul" },
      { stationId: "K333", stationName: "신용산", stationNameEnglish: "Sinyongsan", latitude: 37.4497, longitude: 127.1689, region: "seoul" },
      { stationId: "K334", stationName: "이촌", stationNameEnglish: "Ichon", latitude: 37.4414, longitude: 127.1728, region: "seoul" },
      { stationId: "K335", stationName: "동작", stationNameEnglish: "Dongjak", latitude: 37.4331, longitude: 127.1767, region: "seoul" },
      { stationId: "K336", stationName: "노량진", stationNameEnglish: "Noryangjin", latitude: 37.4247, longitude: 127.1806, region: "seoul" },
      { stationId: "K337", stationName: "흑석", stationNameEnglish: "Heukseok", latitude: 37.4164, longitude: 127.1844, region: "seoul" },
      { stationId: "K338", stationName: "구로", stationNameEnglish: "Guro", latitude: 37.4081, longitude: 127.1883, region: "seoul" },
      { stationId: "K339", stationName: "가산디지털단지", stationNameEnglish: "Gasan Digital Complex", latitude: 37.3997, longitude: 127.1922, region: "seoul" },
      { stationId: "K340", stationName: "독산", stationNameEnglish: "Doksan", latitude: 37.3914, longitude: 127.1961, region: "seoul" },
      { stationId: "K341", stationName: "석수", stationNameEnglish: "Seoksu", latitude: 37.3831, longitude: 127.2000, region: "gyeonggi" },
      { stationId: "K342", stationName: "관악", stationNameEnglish: "Gwanak", latitude: 37.3747, longitude: 127.2039, region: "gyeonggi" },
      { stationId: "K343", stationName: "안양", stationNameEnglish: "Anyang", latitude: 37.3664, longitude: 127.2078, region: "gyeonggi" },
      { stationId: "K344", stationName: "만안", stationNameEnglish: "Manan", latitude: 37.3581, longitude: 127.2117, region: "gyeonggi" },
      { stationId: "K345", stationName: "평촌", stationNameEnglish: "Pyeongchon", latitude: 37.3497, longitude: 127.2156, region: "gyeonggi" },
      { stationId: "K346", stationName: "산본", stationNameEnglish: "Sanbon", latitude: 37.3414, longitude: 127.2194, region: "gyeonggi" },
      { stationId: "K347", stationName: "수리산", stationNameEnglish: "Suriisan", latitude: 37.3331, longitude: 127.2233, region: "gyeonggi" },
      { stationId: "K348", stationName: "대야미", stationNameEnglish: "Daeyami", latitude: 37.3247, longitude: 127.2272, region: "gyeonggi" },
      { stationId: "K349", stationName: "군포", stationNameEnglish: "Gunpo", latitude: 37.3164, longitude: 127.2311, region: "gyeonggi" },
      { stationId: "K350", stationName: "의왕", stationNameEnglish: "Uiwang", latitude: 37.3081, longitude: 127.2350, region: "gyeonggi" },
      { stationId: "K351", stationName: "성균관대", stationNameEnglish: "Sungkyunkwan Univ", latitude: 37.2997, longitude: 127.2389, region: "gyeonggi" },
      { stationId: "K352", stationName: "화서", stationNameEnglish: "Hwaseo", latitude: 37.2914, longitude: 127.2428, region: "gyeonggi" },
      { stationId: "K353", stationName: "수원", stationNameEnglish: "Suwon", latitude: 37.2831, longitude: 127.2467, region: "gyeonggi" },
      { stationId: "K354", stationName: "세류", stationNameEnglish: "Seryu", latitude: 37.2747, longitude: 127.2506, region: "gyeonggi" },
      { stationId: "K355", stationName: "병점", stationNameEnglish: "Byeongjeom", latitude: 37.2664, longitude: 127.2544, region: "gyeonggi" }
    ]
  },
  "line-bundang": {
    lineName: "수인분당선",
    stations: [
      { stationId: "D201", stationName: "왕십리", stationNameEnglish: "Wangsimni", latitude: 37.3650, longitude: 127.0267, region: "seoul" },
      { stationId: "D202", stationName: "서울숲", stationNameEnglish: "Seongsu", latitude: 37.3600, longitude: 127.0367, region: "seoul" },
      { stationId: "D203", stationName: "강남구청", stationNameEnglish: "Gangnam-gu Office", latitude: 37.3550, longitude: 127.0467, region: "seoul" },
      { stationId: "D204", stationName: "도곡", stationNameEnglish: "Dogok", latitude: 37.3500, longitude: 127.0567, region: "seoul" },
      { stationId: "D205", stationName: "대치", stationNameEnglish: "Daechi", latitude: 37.3450, longitude: 127.0667, region: "seoul" },
      { stationId: "D206", stationName: "학여울", stationNameEnglish: "Hakyeoul", latitude: 37.3400, longitude: 127.0767, region: "seoul" },
      { stationId: "D207", stationName: "대청", stationNameEnglish: "Daecheong", latitude: 37.3350, longitude: 127.0867, region: "seoul" },
      { stationId: "D208", stationName: "일원", stationNameEnglish: "Irwon", latitude: 37.3300, longitude: 127.0967, region: "seoul" },
      { stationId: "D209", stationName: "수서", stationNameEnglish: "Suseo", latitude: 37.3250, longitude: 127.1067, region: "seoul" },
      { stationId: "D210", stationName: "복정", stationNameEnglish: "Bokjeong", latitude: 37.3200, longitude: 127.1167, region: "seoul" },
      { stationId: "D211", stationName: "가락시장", stationNameEnglish: "Garak Market", latitude: 37.3150, longitude: 127.1267, region: "seoul" },
      { stationId: "D212", stationName: "경찰병원", stationNameEnglish: "Police Hospital", latitude: 37.3100, longitude: 127.1367, region: "seoul" },
      { stationId: "D213", stationName: "태평", stationNameEnglish: "Taepyeong", latitude: 37.3050, longitude: 127.1467, region: "seoul" },
      { stationId: "D214", stationName: "모란", stationNameEnglish: "Moran", latitude: 37.3000, longitude: 127.1567, region: "gyeonggi" },
      { stationId: "D215", stationName: "수진", stationNameEnglish: "Sujin", latitude: 37.2950, longitude: 127.1667, region: "gyeonggi" },
      { stationId: "D216", stationName: "신흥", stationNameEnglish: "Sinheung", latitude: 37.2900, longitude: 127.1767, region: "gyeonggi" },
      { stationId: "D217", stationName: "광교", stationNameEnglish: "Gwanggyo", latitude: 37.2850, longitude: 127.1867, region: "gyeonggi" },
      { stationId: "D218", stationName: "광교중앙", stationNameEnglish: "Gwanggyo Jungang", latitude: 37.2800, longitude: 127.1967, region: "gyeonggi" },
      { stationId: "D219", stationName: "상현", stationNameEnglish: "Sanghyeon", latitude: 37.2750, longitude: 127.2067, region: "gyeonggi" },
      { stationId: "D220", stationName: "성복", stationNameEnglish: "Seongbok", latitude: 37.2700, longitude: 127.2167, region: "gyeonggi" },
      { stationId: "D221", stationName: "수지구청", stationNameEnglish: "Suji-gu Office", latitude: 37.2650, longitude: 127.2267, region: "gyeonggi" },
      { stationId: "D222", stationName: "동백", stationNameEnglish: "Dongbaek", latitude: 37.2600, longitude: 127.2367, region: "gyeonggi" },
      { stationId: "D223", stationName: "죽전", stationNameEnglish: "Jukjeon", latitude: 37.2550, longitude: 127.2467, region: "gyeonggi" },
      { stationId: "D224", stationName: "시청·용인대", stationNameEnglish: "City Hall · Yongin Univ", latitude: 37.2500, longitude: 127.2567, region: "gyeonggi" },
      { stationId: "D225", stationName: "보정", stationNameEnglish: "Bojeong", latitude: 37.2450, longitude: 127.2667, region: "gyeonggi" },
      { stationId: "D226", stationName: "구성", stationNameEnglish: "Guseong", latitude: 37.2400, longitude: 127.2767, region: "gyeonggi" },
      { stationId: "D227", stationName: "신갈", stationNameEnglish: "Singal", latitude: 37.2350, longitude: 127.2867, region: "gyeonggi" },
      { stationId: "D228", stationName: "기흥", stationNameEnglish: "Giheung", latitude: 37.2300, longitude: 127.2967, region: "gyeonggi" },
      { stationId: "D229", stationName: "상갈", stationNameEnglish: "Sanggal", latitude: 37.2250, longitude: 127.3067, region: "gyeonggi" },
      { stationId: "D230", stationName: "영통", stationNameEnglish: "Yeongtong", latitude: 37.2200, longitude: 127.3167, region: "gyeonggi" },
      { stationId: "D231", stationName: "망포", stationNameEnglish: "Mangpo", latitude: 37.2150, longitude: 127.3267, region: "gyeonggi" },
      { stationId: "D232", stationName: "매교", stationNameEnglish: "Maegyo", latitude: 37.2100, longitude: 127.3367, region: "gyeonggi" },
      { stationId: "D233", stationName: "수원시청", stationNameEnglish: "Suwon City Hall", latitude: 37.2050, longitude: 127.3467, region: "gyeonggi" },
      { stationId: "D234", stationName: "수원", stationNameEnglish: "Suwon", latitude: 37.2000, longitude: 127.3567, region: "gyeonggi" },
      { stationId: "D235", stationName: "고색", stationNameEnglish: "Gosaek", latitude: 37.1950, longitude: 127.3667, region: "gyeonggi" },
      { stationId: "D236", stationName: "오목천", stationNameEnglish: "Omokcheon", latitude: 37.1900, longitude: 127.3767, region: "gyeonggi" },
      { stationId: "D237", stationName: "어천", stationNameEnglish: "Eocheon", latitude: 37.1850, longitude: 127.3867, region: "gyeonggi" },
      { stationId: "D238", stationName: "야목", stationNameEnglish: "Yamok", latitude: 37.1800, longitude: 127.3967, region: "gyeonggi" },
      { stationId: "D239", stationName: "사리", stationNameEnglish: "Sari", latitude: 37.1750, longitude: 127.4067, region: "gyeonggi" },
      { stationId: "D240", stationName: "한대앞", stationNameEnglish: "Hankuk Univ of Foreign Studies", latitude: 37.1700, longitude: 127.4167, region: "gyeonggi" },
      { stationId: "D241", stationName: "고잔", stationNameEnglish: "Gojan", latitude: 37.1650, longitude: 127.4267, region: "gyeonggi" },
      { stationId: "D242", stationName: "초지", stationNameEnglish: "Choji", latitude: 37.1600, longitude: 127.4367, region: "gyeonggi" },
      { stationId: "D243", stationName: "안산", stationNameEnglish: "Ansan", latitude: 37.1550, longitude: 127.4467, region: "gyeonggi" },
      { stationId: "D244", stationName: "선부", stationNameEnglish: "Seonbu", latitude: 37.1500, longitude: 127.4567, region: "gyeonggi" },
      { stationId: "D245", stationName: "원시", stationNameEnglish: "Wonsi", latitude: 37.1450, longitude: 127.4667, region: "incheon" }
    ]
  },
  "line-airport": {
    lineName: "공항철도",
    stations: [
      { stationId: "A01", stationName: "서울역", stationNameEnglish: "Seoul Station", latitude: 37.4661, longitude: 127.0128, region: "seoul" },
      { stationId: "A02", stationName: "공항시장", stationNameEnglish: "Airport Market", latitude: 37.4800, longitude: 126.8800, region: "seoul" },
      { stationId: "A03", stationName: "신방화", stationNameEnglish: "Sinbanghwa", latitude: 37.4900, longitude: 126.8500, region: "seoul" },
      { stationId: "A04", stationName: "마곡나루", stationNameEnglish: "Magoknaru", latitude: 37.5000, longitude: 126.8200, region: "seoul" },
      { stationId: "A05", stationName: "김포공항", stationNameEnglish: "Gimpo Airport", latitude: 37.5609, longitude: 126.7958, region: "seoul" },
      { stationId: "A06", stationName: "계양", stationNameEnglish: "Geyang", latitude: 37.5381, longitude: 126.7342, region: "incheon" },
      { stationId: "A07", stationName: "귤현", stationNameEnglish: "Gyulhyeon", latitude: 37.5200, longitude: 126.7200, region: "incheon" },
      { stationId: "A08", stationName: "백석", stationNameEnglish: "Baekseok", latitude: 37.5000, longitude: 126.7000, region: "incheon" },
      { stationId: "A09", stationName: "운서", stationNameEnglish: "Unseo", latitude: 37.4800, longitude: 126.6800, region: "incheon" },
      { stationId: "A10", stationName: "영종도", stationNameEnglish: "Yeongjongdo", latitude: 37.4600, longitude: 126.6600, region: "incheon" },
      { stationId: "A11", stationName: "인천공항1터미널", stationNameEnglish: "Incheon Airport T1", latitude: 37.4492, longitude: 126.4508, region: "incheon" },
      { stationId: "A12", stationName: "인천공항2터미널", stationNameEnglish: "Incheon Airport T2", latitude: 37.4400, longitude: 126.4400, region: "incheon" }
    ]
  },
  "line-gyungchun": {
    lineName: "경춘선",
    stations: [
      { stationId: "K116", stationName: "청량리", stationNameEnglish: "Cheongnyangni", latitude: 37.5406, longitude: 127.0442, region: "seoul" },
      { stationId: "K117", stationName: "회기", stationNameEnglish: "Hoegi", latitude: 37.5547, longitude: 127.0450, region: "seoul" },
      { stationId: "K118", stationName: "중랑", stationNameEnglish: "Jungnang", latitude: 37.5689, longitude: 127.0456, region: "seoul" },
      { stationId: "K119", stationName: "망우", stationNameEnglish: "Mangu", latitude: 37.5886, longitude: 127.1039, region: "seoul" },
      { stationId: "K120", stationName: "도농", stationNameEnglish: "Donong", latitude: 37.5998, longitude: 127.1216, region: "gyeonggi" },
      { stationId: "K121", stationName: "양정", stationNameEnglish: "Yangjeong", latitude: 37.6075, longitude: 127.1319, region: "gyeonggi" },
      { stationId: "K122", stationName: "덕소", stationNameEnglish: "Deokso", latitude: 37.6181, longitude: 127.1533, region: "gyeonggi" },
      { stationId: "K123", stationName: "도심", stationNameEnglish: "Dosim", latitude: 37.6289, longitude: 127.1764, region: "gyeonggi" },
      { stationId: "K124", stationName: "팔당", stationNameEnglish: "Paldang", latitude: 37.6423, longitude: 127.1945, region: "gyeonggi" },
      { stationId: "K125", stationName: "운길산", stationNameEnglish: "Unjeolsan", latitude: 37.6556, longitude: 127.2125, region: "gyeonggi" },
      { stationId: "K126", stationName: "갈매", stationNameEnglish: "Galmae", latitude: 37.6689, longitude: 127.2306, region: "gyeonggi" },
      { stationId: "K127", stationName: "부발", stationNameEnglish: "Bubal", latitude: 37.6822, longitude: 127.2486, region: "gyeonggi" },
      { stationId: "K128", stationName: "청평", stationNameEnglish: "Cheongpyeong", latitude: 37.6956, longitude: 127.2667, region: "gyeonggi" },
      { stationId: "K129", stationName: "상천", stationNameEnglish: "Sangcheon", latitude: 37.7089, longitude: 127.2847, region: "gyeonggi" },
      { stationId: "K130", stationName: "경춘", stationNameEnglish: "Gyeongchun", latitude: 37.7222, longitude: 127.3028, region: "gangwon" },
      { stationId: "K131", stationName: "평내호평", stationNameEnglish: "Pyeongnae-Hopyeong", latitude: 37.7356, longitude: 127.3208, region: "gangwon" },
      { stationId: "K132", stationName: "마석", stationNameEnglish: "Maseok", latitude: 37.7489, longitude: 127.3389, region: "gangwon" },
      { stationId: "K133", stationName: "천마산", stationNameEnglish: "Cheonmasan", latitude: 37.7622, longitude: 127.3569, region: "gangwon" },
      { stationId: "K134", stationName: "대월", stationNameEnglish: "Daewol", latitude: 37.7756, longitude: 127.3750, region: "gangwon" },
      { stationId: "K135", stationName: "평내", stationNameEnglish: "Pyeongnae", latitude: 37.7889, longitude: 127.3931, region: "gangwon" },
      { stationId: "K136", stationName: "금곶", stationNameEnglish: "Geumgang", latitude: 37.8022, longitude: 127.4111, region: "gangwon" },
      { stationId: "K137", stationName: "춘천", stationNameEnglish: "Chuncheon", latitude: 37.8156, longitude: 127.4292, region: "gangwon" }
    ]
  }
};

async function importOtherStations() {
  const batch = db.batch();
  let count = 0;

  for (const [lineId, lineData] of Object.entries(otherStations)) {
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
        isTerminus: station.stationId.endsWith('0') || station.stationId.endsWith('1'),
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
  console.log(`✅ 기타 노선 ${count}개 역 import 완료`);
}

importOtherStations().catch(console.error);
