// Factual campus names compiled from cited university pages; not an official GIS export.
export const EXTENSION_SOURCES={
  "dorm-network": {
    "title": "交大NIMO：宿舍网络用户手册（2025，页面更新2026-09-06）",
    "url": "https://nimo.sjtu.edu.cn/wiki/user-manual-2024/",
    "published": null,
    "evidence": "公开楼栋编号清单，仅展开列明范围，不补齐缺号"
  },
  "campus-map": {
    "title": "上海交通大学校园电子地图：公开页面具名地点",
    "url": "https://map.sjtu.edu.cn/",
    "published": null,
    "evidence": "页面文字；动态接口编码异常未导入；不采用旧营业时段"
  },
  "campus-roads": {
    "title": "交大保卫处：闵行道路施工通知",
    "url": "https://bwc.sjtu.edu.cn/note/173",
    "published": null,
    "evidence": "搜索索引中的具名校内道路，不采用历史封路时段"
  },
  "road-energy": {
    "title": "2018—2019年度交大节能管理工作情况",
    "url": "https://gk.sjtu.edu.cn/Assets/userfiles/sys_eb538c1c-65ff-4e82-8e6a-a1ef01127fed/files/20211011/20211011155129319.pdf",
    "published": null,
    "evidence": "公开索引列明路灯改造涉及的道路名称"
  },
  "graduate-addresses": {
    "title": "交大研招办：2025博士生致远荣誉计划学院联系方式",
    "url": "https://yzb.sjtu.edu.cn/storage/gs/web/yzbcn/article/2025/07/3426784b187511eaf121b6301bbd1497.pdf",
    "published": null,
    "evidence": "PDF原文明确闵行地址的楼宇名；不导入联系人或房间号"
  },
  "material-main": {
    "title": "材料学院：徐祖耀楼揭牌及冠名说明",
    "url": "https://smse.sjtu.edu.cn/post/detail/1458",
    "published": null
  },
  "material-innovation": {
    "title": "国际研究生院系联系地址（材料创新大楼）",
    "url": "https://isc.sjtu.edu.cn/kindeditor/Upload/file/20251024/20251024171824_1724.pdf",
    "published": null,
    "evidence": "公开检索索引，PDF正文当前无法取回"
  },
  "microelectronics": {
    "title": "交大仪器共享平台：微纳加工平台",
    "url": "https://openlab.sjtu.edu.cn/portal/aemd",
    "published": null
  },
  "biomedical": {
    "title": "生物医学工程学院：联系我们（分列闵行与徐汇）",
    "url": "https://bme.sjtu.edu.cn/Web/Show/389",
    "published": "2016-01-04"
  },
  "longbin": {
    "title": "浦江国际学院：龙宾楼",
    "url": "https://gc.sjtu.edu.cn/cn/about/building-introduction/",
    "published": null
  },
  "science": {
    "title": "交大基建处：理科楼群",
    "url": "https://jjc.sjtu.edu.cn/info/1042/1289.htm",
    "published": null
  },
  "jingjing": {
    "title": "交大校史博物馆：菁菁堂",
    "url": "https://museum.sjtu.edu.cn/info/1037/1655.htm",
    "published": null
  },
  "museum": {
    "title": "交大：文博场馆恢复开放公告",
    "url": "https://www.sjtu.edu.cn/tg/20221102/175878.html",
    "published": "2022-11-02"
  },
  "isc-visit": {
    "title": "留学交大：2017校园参观（分列闵行与徐汇）",
    "url": "https://isc.sjtu.edu.cn/cn/show.aspx?flag=68&info_id=782&info_lb=68",
    "published": null
  },
  "water": {
    "title": "交大新闻：闵行河道水环境考察",
    "url": "https://news.sjtu.edu.cn/jdyw/20200113/119137.html",
    "published": "2020-01-13"
  },
  "lake": {
    "title": "交大新闻：校园公园实践（思源湖、仰思坪）",
    "url": "https://news.sjtu.edu.cn/mtjj/20240605/198536.html",
    "published": "2024-06-05"
  },
  "hospital": {
    "title": "交大生物医学工程学院：校园服务说明（校医院）",
    "url": "https://bme.sjtu.edu.cn/Web/Show/1496",
    "published": null
  },
  "mechanical": {
    "title": "机械与动力工程学院：行政办公室",
    "url": "https://me.sjtu.edu.cn/xzbgs.html",
    "published": null
  },
  "green": {
    "title": "交大仪器共享平台：系统生物医学研究院",
    "url": "https://openlab.sjtu.edu.cn/portal/scsb",
    "published": null
  },
  "old-admin": {
    "title": "交大退休教职工办事向导：分列两校区",
    "url": "https://www.oldage.sjtu.edu.cn/2.pdf",
    "published": null,
    "evidence": "公开索引的闵行老行政楼名称，不导入历史办事时间"
  },
  "dining-extra": {
    "title": "交大家园2023新生美食指南",
    "url": "https://ourhome.sjtu.edu.cn/article/1057",
    "published": "2023-08-22"
  },
  "gate-history": {
    "title": "交大新闻：思源门历史及俗称",
    "url": "https://news.sjtu.edu.cn/hlxy/20190221/96079.html",
    "published": "2019-02-21"
  }
};
export const EXTENSION_PLACES=[
  {
    "id": "sjtu-mh:dorm:east:1",
    "name": "东1号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东1号学生公寓",
      "东1",
      "东01",
      "东区1号楼",
      "东1宿舍",
      "D1",
      "D01"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:2",
    "name": "东2号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东2号学生公寓",
      "东2",
      "东02",
      "东区2号楼",
      "东2宿舍",
      "D2",
      "D02"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:3",
    "name": "东3号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东3号学生公寓",
      "东3",
      "东03",
      "东区3号楼",
      "东3宿舍",
      "D3",
      "D03"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:4",
    "name": "东4号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东4号学生公寓",
      "东4",
      "东04",
      "东区4号楼",
      "东4宿舍",
      "D4",
      "D04"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:5",
    "name": "东5号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东5号学生公寓",
      "东5",
      "东05",
      "东区5号楼",
      "东5宿舍",
      "D5",
      "D05"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:6",
    "name": "东6号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东6号学生公寓",
      "东6",
      "东06",
      "东区6号楼",
      "东6宿舍",
      "D6",
      "D06"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:7",
    "name": "东7号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东7号学生公寓",
      "东7",
      "东07",
      "东区7号楼",
      "东7宿舍",
      "D7",
      "D07"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:8",
    "name": "东8号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东8号学生公寓",
      "东8",
      "东08",
      "东区8号楼",
      "东8宿舍",
      "D8",
      "D08"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:9",
    "name": "东9号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东9号学生公寓",
      "东9",
      "东09",
      "东区9号楼",
      "东9宿舍",
      "D9",
      "D09"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:10",
    "name": "东10号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东10号学生公寓",
      "东10",
      "东区10号楼",
      "东10宿舍",
      "D10"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:11",
    "name": "东11号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东11号学生公寓",
      "东11",
      "东区11号楼",
      "东11宿舍",
      "D11"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:12",
    "name": "东12号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东12号学生公寓",
      "东12",
      "东区12号楼",
      "东12宿舍",
      "D12"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:13",
    "name": "东13号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东13号学生公寓",
      "东13",
      "东区13号楼",
      "东13宿舍",
      "D13"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:14",
    "name": "东14号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东14号学生公寓",
      "东14",
      "东区14号楼",
      "东14宿舍",
      "D14"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:15",
    "name": "东15号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东15号学生公寓",
      "东15",
      "东区15号楼",
      "东15宿舍",
      "D15"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:16",
    "name": "东16号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东16号学生公寓",
      "东16",
      "东区16号楼",
      "东16宿舍",
      "D16"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:17",
    "name": "东17号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东17号学生公寓",
      "东17",
      "东区17号楼",
      "东17宿舍",
      "D17"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:18",
    "name": "东18号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东18号学生公寓",
      "东18",
      "东区18号楼",
      "东18宿舍",
      "D18"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:19",
    "name": "东19号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东19号学生公寓",
      "东19",
      "东区19号楼",
      "东19宿舍",
      "D19"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:20",
    "name": "东20号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东20号学生公寓",
      "东20",
      "东区20号楼",
      "东20宿舍",
      "D20"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:21",
    "name": "东21号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东21号学生公寓",
      "东21",
      "东区21号楼",
      "东21宿舍",
      "D21"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:22",
    "name": "东22号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东22号学生公寓",
      "东22",
      "东区22号楼",
      "东22宿舍",
      "D22"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:23",
    "name": "东23号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东23号学生公寓",
      "东23",
      "东区23号楼",
      "东23宿舍",
      "D23"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:24",
    "name": "东24号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东24号学生公寓",
      "东24",
      "东区24号楼",
      "东24宿舍",
      "D24"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:25",
    "name": "东25号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东25号学生公寓",
      "东25",
      "东区25号楼",
      "东25宿舍",
      "D25"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:26",
    "name": "东26号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东26号学生公寓",
      "东26",
      "东区26号楼",
      "东26宿舍",
      "D26"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:27",
    "name": "东27号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东27号学生公寓",
      "东27",
      "东区27号楼",
      "东27宿舍",
      "D27"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:28",
    "name": "东28号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东28号学生公寓",
      "东28",
      "东区28号楼",
      "东28宿舍",
      "D28"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:29",
    "name": "东29号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东29号学生公寓",
      "东29",
      "东区29号楼",
      "东29宿舍",
      "D29"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:30",
    "name": "东30号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东30号学生公寓",
      "东30",
      "东区30号楼",
      "东30宿舍",
      "D30"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:31",
    "name": "东31号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东31号学生公寓",
      "东31",
      "东区31号楼",
      "东31宿舍",
      "D31"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:32",
    "name": "东32号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东32号学生公寓",
      "东32",
      "东区32号楼",
      "东32宿舍",
      "D32"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:33",
    "name": "东33号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东33号学生公寓",
      "东33",
      "东区33号楼",
      "东33宿舍",
      "D33"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:34",
    "name": "东34号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东34号学生公寓",
      "东34",
      "东区34号楼",
      "东34宿舍",
      "D34"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:east:35",
    "name": "东35号学生公寓",
    "kind": "dorm",
    "aliases": [
      "东35号学生公寓",
      "东35",
      "东区35号楼",
      "东35宿舍",
      "D35"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:8",
    "name": "西8号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西8号学生公寓",
      "西8",
      "西08",
      "西区8号楼",
      "西8宿舍",
      "X8",
      "X08"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:9",
    "name": "西9号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西9号学生公寓",
      "西9",
      "西09",
      "西区9号楼",
      "西9宿舍",
      "X9",
      "X09"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:10",
    "name": "西10号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西10号学生公寓",
      "西10",
      "西区10号楼",
      "西10宿舍",
      "X10"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:11",
    "name": "西11号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西11号学生公寓",
      "西11",
      "西区11号楼",
      "西11宿舍",
      "X11"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:12",
    "name": "西12号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西12号学生公寓",
      "西12",
      "西区12号楼",
      "西12宿舍",
      "X12"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:13",
    "name": "西13号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西13号学生公寓",
      "西13",
      "西区13号楼",
      "西13宿舍",
      "X13"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:14",
    "name": "西14号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西14号学生公寓",
      "西14",
      "西区14号楼",
      "西14宿舍",
      "X14"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:15",
    "name": "西15号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西15号学生公寓",
      "西15",
      "西区15号楼",
      "西15宿舍",
      "X15"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:16",
    "name": "西16号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西16号学生公寓",
      "西16",
      "西区16号楼",
      "西16宿舍",
      "X16"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:17",
    "name": "西17号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西17号学生公寓",
      "西17",
      "西区17号楼",
      "西17宿舍",
      "X17"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:18",
    "name": "西18号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西18号学生公寓",
      "西18",
      "西区18号楼",
      "西18宿舍",
      "X18"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:19",
    "name": "西19号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西19号学生公寓",
      "西19",
      "西区19号楼",
      "西19宿舍",
      "X19"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:20",
    "name": "西20号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西20号学生公寓",
      "西20",
      "西区20号楼",
      "西20宿舍",
      "X20"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:21",
    "name": "西21号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西21号学生公寓",
      "西21",
      "西区21号楼",
      "西21宿舍",
      "X21"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:22",
    "name": "西22号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西22号学生公寓",
      "西22",
      "西区22号楼",
      "西22宿舍",
      "X22"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:23",
    "name": "西23号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西23号学生公寓",
      "西23",
      "西区23号楼",
      "西23宿舍",
      "X23"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:24",
    "name": "西24号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西24号学生公寓",
      "西24",
      "西区24号楼",
      "西24宿舍",
      "X24"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:25",
    "name": "西25号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西25号学生公寓",
      "西25",
      "西区25号楼",
      "西25宿舍",
      "X25"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:26",
    "name": "西26号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西26号学生公寓",
      "西26",
      "西区26号楼",
      "西26宿舍",
      "X26"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:27",
    "name": "西27号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西27号学生公寓",
      "西27",
      "西区27号楼",
      "西27宿舍",
      "X27"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:28",
    "name": "西28号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西28号学生公寓",
      "西28",
      "西区28号楼",
      "西28宿舍",
      "X28"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:29",
    "name": "西29号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西29号学生公寓",
      "西29",
      "西区29号楼",
      "西29宿舍",
      "X29"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:30",
    "name": "西30号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西30号学生公寓",
      "西30",
      "西区30号楼",
      "西30宿舍",
      "X30"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:31",
    "name": "西31号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西31号学生公寓",
      "西31",
      "西区31号楼",
      "西31宿舍",
      "X31"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:32",
    "name": "西32号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西32号学生公寓",
      "西32",
      "西区32号楼",
      "西32宿舍",
      "X32"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:33",
    "name": "西33号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西33号学生公寓",
      "西33",
      "西区33号楼",
      "西33宿舍",
      "X33"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:34",
    "name": "西34号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西34号学生公寓",
      "西34",
      "西区34号楼",
      "西34宿舍",
      "X34"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:35",
    "name": "西35号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西35号学生公寓",
      "西35",
      "西区35号楼",
      "西35宿舍",
      "X35"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:36",
    "name": "西36号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西36号学生公寓",
      "西36",
      "西区36号楼",
      "西36宿舍",
      "X36"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:37",
    "name": "西37号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西37号学生公寓",
      "西37",
      "西区37号楼",
      "西37宿舍",
      "X37"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:38",
    "name": "西38号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西38号学生公寓",
      "西38",
      "西区38号楼",
      "西38宿舍",
      "X38"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:39",
    "name": "西39号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西39号学生公寓",
      "西39",
      "西区39号楼",
      "西39宿舍",
      "X39"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:40",
    "name": "西40号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西40号学生公寓",
      "西40",
      "西区40号楼",
      "西40宿舍",
      "X40"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:41",
    "name": "西41号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西41号学生公寓",
      "西41",
      "西区41号楼",
      "西41宿舍",
      "X41"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:42",
    "name": "西42号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西42号学生公寓",
      "西42",
      "西区42号楼",
      "西42宿舍",
      "X42"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:43",
    "name": "西43号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西43号学生公寓",
      "西43",
      "西区43号楼",
      "西43宿舍",
      "X43"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:44",
    "name": "西44号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西44号学生公寓",
      "西44",
      "西区44号楼",
      "西44宿舍",
      "X44"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:45",
    "name": "西45号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西45号学生公寓",
      "西45",
      "西区45号楼",
      "西45宿舍",
      "X45"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:46",
    "name": "西46号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西46号学生公寓",
      "西46",
      "西区46号楼",
      "西46宿舍",
      "X46"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:47",
    "name": "西47号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西47号学生公寓",
      "西47",
      "西区47号楼",
      "西47宿舍",
      "X47"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:48",
    "name": "西48号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西48号学生公寓",
      "西48",
      "西区48号楼",
      "西48宿舍",
      "X48"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:49",
    "name": "西49号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西49号学生公寓",
      "西49",
      "西区49号楼",
      "西49宿舍",
      "X49"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:50",
    "name": "西50号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西50号学生公寓",
      "西50",
      "西区50号楼",
      "西50宿舍",
      "X50"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:51",
    "name": "西51号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西51号学生公寓",
      "西51",
      "西区51号楼",
      "西51宿舍",
      "X51"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:52",
    "name": "西52号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西52号学生公寓",
      "西52",
      "西区52号楼",
      "西52宿舍",
      "X52"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:53",
    "name": "西53号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西53号学生公寓",
      "西53",
      "西区53号楼",
      "西53宿舍",
      "X53"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:54",
    "name": "西54号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西54号学生公寓",
      "西54",
      "西区54号楼",
      "西54宿舍",
      "X54"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:55",
    "name": "西55号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西55号学生公寓",
      "西55",
      "西区55号楼",
      "西55宿舍",
      "X55"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:56",
    "name": "西56号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西56号学生公寓",
      "西56",
      "西区56号楼",
      "西56宿舍",
      "X56"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:57",
    "name": "西57号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西57号学生公寓",
      "西57",
      "西区57号楼",
      "西57宿舍",
      "X57"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:58",
    "name": "西58号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西58号学生公寓",
      "西58",
      "西区58号楼",
      "西58宿舍",
      "X58"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:59",
    "name": "西59号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西59号学生公寓",
      "西59",
      "西区59号楼",
      "西59宿舍",
      "X59"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:60",
    "name": "西60号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西60号学生公寓",
      "西60",
      "西区60号楼",
      "西60宿舍",
      "X60"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:61",
    "name": "西61号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西61号学生公寓",
      "西61",
      "西区61号楼",
      "西61宿舍",
      "X61"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:62",
    "name": "西62号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西62号学生公寓",
      "西62",
      "西区62号楼",
      "西62宿舍",
      "X62"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:63",
    "name": "西63号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西63号学生公寓",
      "西63",
      "西区63号楼",
      "西63宿舍",
      "X63"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:64",
    "name": "西64号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西64号学生公寓",
      "西64",
      "西区64号楼",
      "西64宿舍",
      "X64"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:65",
    "name": "西65号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西65号学生公寓",
      "西65",
      "西区65号楼",
      "西65宿舍",
      "X65"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:66",
    "name": "西66号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西66号学生公寓",
      "西66",
      "西区66号楼",
      "西66宿舍",
      "X66"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:67",
    "name": "西67号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西67号学生公寓",
      "西67",
      "西区67号楼",
      "西67宿舍",
      "X67"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:68",
    "name": "西68号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西68号学生公寓",
      "西68",
      "西区68号楼",
      "西68宿舍",
      "X68"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:69",
    "name": "西69号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西69号学生公寓",
      "西69",
      "西区69号楼",
      "西69宿舍",
      "X69"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:70",
    "name": "西70号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西70号学生公寓",
      "西70",
      "西区70号楼",
      "西70宿舍",
      "X70"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:81",
    "name": "西81号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西81号学生公寓",
      "西81",
      "西区81号楼",
      "西81宿舍",
      "X81"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:82",
    "name": "西82号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西82号学生公寓",
      "西82",
      "西区82号楼",
      "西82宿舍",
      "X82"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:83",
    "name": "西83号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西83号学生公寓",
      "西83",
      "西区83号楼",
      "西83宿舍",
      "X83"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:84",
    "name": "西84号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西84号学生公寓",
      "西84",
      "西区84号楼",
      "西84宿舍",
      "X84"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:85",
    "name": "西85号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西85号学生公寓",
      "西85",
      "西区85号楼",
      "西85宿舍",
      "X85"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:86",
    "name": "西86号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西86号学生公寓",
      "西86",
      "西区86号楼",
      "西86宿舍",
      "X86"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:87",
    "name": "西87号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西87号学生公寓",
      "西87",
      "西区87号楼",
      "西87宿舍",
      "X87"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:west:43b",
    "name": "西43B号学生公寓",
    "kind": "dorm",
    "aliases": [
      "西43B号学生公寓",
      "西43B",
      "西区43B号楼",
      "X43B"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:phd:1",
    "name": "博士生公寓1号楼",
    "kind": "dorm",
    "aliases": [
      "博士生公寓1号楼",
      "博士生公寓1号",
      "博士生公寓1栋",
      "博士公寓1号楼"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:phd:2",
    "name": "博士生公寓2号楼",
    "kind": "dorm",
    "aliases": [
      "博士生公寓2号楼",
      "博士生公寓2号",
      "博士生公寓2栋",
      "博士公寓2号楼"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:phd:3",
    "name": "博士生公寓3号楼",
    "kind": "dorm",
    "aliases": [
      "博士生公寓3号楼",
      "博士生公寓3号",
      "博士生公寓3栋",
      "博士公寓3号楼"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:phd:4",
    "name": "博士生公寓4号楼",
    "kind": "dorm",
    "aliases": [
      "博士生公寓4号楼",
      "博士生公寓4号",
      "博士生公寓4栋",
      "博士公寓4号楼"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:phd:5",
    "name": "博士生公寓5号楼",
    "kind": "dorm",
    "aliases": [
      "博士生公寓5号楼",
      "博士生公寓5号",
      "博士生公寓5栋",
      "博士公寓5号楼"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:phd:6",
    "name": "博士生公寓6号楼",
    "kind": "dorm",
    "aliases": [
      "博士生公寓6号楼",
      "博士生公寓6号",
      "博士生公寓6栋",
      "博士公寓6号楼"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:phd:7",
    "name": "博士生公寓7号楼",
    "kind": "dorm",
    "aliases": [
      "博士生公寓7号楼",
      "博士生公寓7号",
      "博士生公寓7栋",
      "博士公寓7号楼"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:phd:8",
    "name": "博士生公寓8号楼",
    "kind": "dorm",
    "aliases": [
      "博士生公寓8号楼",
      "博士生公寓8号",
      "博士生公寓8栋",
      "博士公寓8号楼"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:phd:9",
    "name": "博士生公寓9号楼",
    "kind": "dorm",
    "aliases": [
      "博士生公寓9号楼",
      "博士生公寓9号",
      "博士生公寓9栋",
      "博士公寓9号楼"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:phd:10",
    "name": "博士生公寓10号楼",
    "kind": "dorm",
    "aliases": [
      "博士生公寓10号楼",
      "博士生公寓10号",
      "博士生公寓10栋",
      "博士公寓10号楼"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dorm:zhenzhen",
    "name": "蓁蓁楼",
    "kind": "dorm",
    "aliases": [
      "蓁蓁楼"
    ],
    "source": "dorm-network",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:gate:east",
    "name": "东大门",
    "kind": "gate",
    "aliases": [
      "东大门",
      "莲花路5000号校门",
      "莲花南路5000号校门"
    ],
    "source": "campus-map",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:gate:north1",
    "name": "北一门",
    "kind": "gate",
    "aliases": [
      "北一门",
      "北1门",
      "剑川路901号校门"
    ],
    "source": "campus-map",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:gate:north2",
    "name": "北二门",
    "kind": "gate",
    "aliases": [
      "北二门",
      "北2门",
      "剑川路701号校门"
    ],
    "source": "campus-map",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:gate:north3",
    "name": "北三门",
    "kind": "gate",
    "aliases": [
      "北三门",
      "北3门",
      "剑川路601号校门"
    ],
    "source": "campus-map",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:gate:west2",
    "name": "西二门",
    "kind": "gate",
    "aliases": [
      "西二门",
      "西2门",
      "沧源路1101号校门"
    ],
    "source": "campus-map",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:gate:swimming",
    "name": "游泳馆门",
    "kind": "gate",
    "aliases": [
      "游泳馆门",
      "沧源路1001号校门"
    ],
    "source": "campus-map",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:road:notice:0",
    "name": "南洋北路",
    "kind": "road",
    "aliases": [
      "南洋北路"
    ],
    "source": "campus-roads",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:road:notice:1",
    "name": "南洋南路",
    "kind": "road",
    "aliases": [
      "南洋南路"
    ],
    "source": "campus-roads",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:road:notice:2",
    "name": "南洋西路",
    "kind": "road",
    "aliases": [
      "南洋西路"
    ],
    "source": "campus-roads",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:road:notice:3",
    "name": "思源南路",
    "kind": "road",
    "aliases": [
      "思源南路"
    ],
    "source": "campus-roads",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:road:notice:4",
    "name": "思源西路",
    "kind": "road",
    "aliases": [
      "思源西路"
    ],
    "source": "campus-roads",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:road:notice:5",
    "name": "光明路",
    "kind": "road",
    "aliases": [
      "光明路"
    ],
    "source": "campus-roads",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:road:notice:6",
    "name": "光宪路",
    "kind": "road",
    "aliases": [
      "光宪路"
    ],
    "source": "campus-roads",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:road:notice:7",
    "name": "精勤路",
    "kind": "road",
    "aliases": [
      "精勤路"
    ],
    "source": "campus-roads",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:road:notice:8",
    "name": "文俊路",
    "kind": "road",
    "aliases": [
      "文俊路"
    ],
    "source": "campus-roads",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:road:notice:9",
    "name": "学森路",
    "kind": "road",
    "aliases": [
      "学森路"
    ],
    "source": "campus-roads",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:road:notice:10",
    "name": "宣怀大道",
    "kind": "road",
    "aliases": [
      "宣怀大道"
    ],
    "source": "campus-roads",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:road:notice:11",
    "name": "元培路",
    "kind": "road",
    "aliases": [
      "元培路"
    ],
    "source": "campus-roads",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:road:notice:12",
    "name": "叔同路",
    "kind": "road",
    "aliases": [
      "叔同路"
    ],
    "source": "campus-roads",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:road:energy:0",
    "name": "纬六路",
    "kind": "road",
    "aliases": [
      "纬六路"
    ],
    "source": "road-energy",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:road:energy:1",
    "name": "龙坡路",
    "kind": "road",
    "aliases": [
      "龙坡路"
    ],
    "source": "road-energy",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:road:energy:2",
    "name": "文治大道",
    "kind": "road",
    "aliases": [
      "文治大道"
    ],
    "source": "road-energy",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:academic:mulan",
    "name": "木兰楼",
    "kind": "teaching",
    "aliases": [
      "木兰楼",
      "木兰大楼"
    ],
    "source": "graduate-addresses",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:academic:mechanical",
    "name": "机械楼",
    "kind": "teaching",
    "aliases": [
      "机械楼"
    ],
    "source": "graduate-addresses",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:academic:mechanical-a",
    "name": "机械楼A楼",
    "kind": "teaching",
    "aliases": [
      "机械楼A楼",
      "机械楼A"
    ],
    "source": "graduate-addresses",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false,
    "parentId": "sjtu-mh:academic:mechanical"
  },
  {
    "id": "sjtu-mh:academic:seiee",
    "name": "电信群楼",
    "kind": "teaching",
    "aliases": [
      "电信群楼",
      "电院群楼",
      "电信楼群"
    ],
    "source": "graduate-addresses",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:academic:seiee1",
    "name": "电信群楼1号楼",
    "kind": "teaching",
    "aliases": [
      "电信群楼1号楼",
      "电院1号楼",
      "电院群楼1号楼",
      "电信1号楼"
    ],
    "source": "material-innovation",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false,
    "parentId": "sjtu-mh:academic:seiee"
  },
  {
    "id": "sjtu-mh:academic:seiee3",
    "name": "电院群楼3号楼",
    "kind": "teaching",
    "aliases": [
      "电院群楼3号楼",
      "电院3号楼",
      "电信群楼3号楼"
    ],
    "source": "graduate-addresses",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false,
    "parentId": "sjtu-mh:academic:seiee"
  },
  {
    "id": "sjtu-mh:academic:materials",
    "name": "徐祖耀楼",
    "kind": "teaching",
    "aliases": [
      "徐祖耀楼",
      "材料学院主楼"
    ],
    "source": "material-main",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:academic:materials-a",
    "name": "材料A楼",
    "kind": "teaching",
    "aliases": [
      "材料A楼",
      "材料A"
    ],
    "source": "graduate-addresses",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:academic:materials-innovation",
    "name": "材料创新大楼",
    "kind": "teaching",
    "aliases": [
      "材料创新大楼",
      "材料创新楼"
    ],
    "source": "material-innovation",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:academic:science",
    "name": "理科楼群",
    "kind": "teaching",
    "aliases": [
      "理科楼群",
      "理科群楼"
    ],
    "source": "science",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:academic:science5",
    "name": "理科楼5号楼",
    "kind": "teaching",
    "aliases": [
      "理科楼5号楼",
      "理科群楼5号楼",
      "理科5号楼"
    ],
    "source": "graduate-addresses",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false,
    "parentId": "sjtu-mh:academic:science"
  },
  {
    "id": "sjtu-mh:academic:science6",
    "name": "理科群楼6号楼",
    "kind": "teaching",
    "aliases": [
      "理科群楼6号楼",
      "理科楼6号楼",
      "理科6号楼"
    ],
    "source": "graduate-addresses",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false,
    "parentId": "sjtu-mh:academic:science"
  },
  {
    "id": "sjtu-mh:academic:life2",
    "name": "生命科学技术学院2号楼",
    "kind": "teaching",
    "aliases": [
      "生命科学技术学院2号楼",
      "生命学院2号楼",
      "生命科学楼2号楼"
    ],
    "source": "graduate-addresses",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:academic:systems",
    "name": "系统生物医学研究中心大楼",
    "kind": "teaching",
    "aliases": [
      "系统生物医学研究中心大楼",
      "系统生物医学研究院",
      "系统生物医学楼"
    ],
    "source": "green",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:academic:xiaguang",
    "name": "霞光楼",
    "kind": "teaching",
    "aliases": [
      "霞光楼"
    ],
    "source": "graduate-addresses",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:academic:agri",
    "name": "农业与生物学院A楼",
    "kind": "teaching",
    "aliases": [
      "农业与生物学院A楼",
      "农生学院A楼"
    ],
    "source": "material-innovation",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:academic:environment",
    "name": "绿色环境楼",
    "kind": "teaching",
    "aliases": [
      "绿色环境楼",
      "环境学院绿色环境楼"
    ],
    "source": "graduate-addresses",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:academic:pharmacy5",
    "name": "药学院5号楼",
    "kind": "teaching",
    "aliases": [
      "药学院5号楼"
    ],
    "source": "graduate-addresses",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:academic:longbin",
    "name": "龙宾楼",
    "kind": "teaching",
    "aliases": [
      "龙宾楼",
      "浦江国际学院大楼"
    ],
    "source": "longbin",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:academic:microelectronics",
    "name": "微电子大楼",
    "kind": "teaching",
    "aliases": [
      "微电子大楼",
      "微电子楼"
    ],
    "source": "microelectronics",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:academic:wenxuan",
    "name": "文选医学楼",
    "kind": "teaching",
    "aliases": [
      "文选医学楼",
      "文选楼",
      "文选医学大楼"
    ],
    "source": "biomedical",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:academic:thermal",
    "name": "热动楼",
    "kind": "teaching",
    "aliases": [
      "热动楼"
    ],
    "source": "mechanical",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:academic:new-engineering",
    "name": "新工程馆",
    "kind": "teaching",
    "aliases": [
      "新工程馆"
    ],
    "source": "mechanical",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:culture:jingjing",
    "name": "菁菁堂",
    "kind": "culture",
    "aliases": [
      "菁菁堂"
    ],
    "source": "jingjing",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:culture:wenbo",
    "name": "文博楼",
    "kind": "culture",
    "aliases": [
      "文博楼",
      "档案文博楼"
    ],
    "source": "museum",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:culture:museum",
    "name": "校史博物馆",
    "kind": "culture",
    "aliases": [
      "校史博物馆",
      "闵行校史博物馆"
    ],
    "source": "museum",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false,
    "parentId": "sjtu-mh:culture:wenbo"
  },
  {
    "id": "sjtu-mh:culture:chengji",
    "name": "程及美术馆",
    "kind": "culture",
    "aliases": [
      "程及美术馆"
    ],
    "source": "isc-visit",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:service:guangbiao",
    "name": "光彪楼",
    "kind": "service",
    "aliases": [
      "光彪楼"
    ],
    "source": "isc-visit",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:service:academic",
    "name": "学术活动中心",
    "kind": "service",
    "aliases": [
      "学术活动中心"
    ],
    "source": "campus-map",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:service:express",
    "name": "快递服务中心",
    "kind": "service",
    "aliases": [
      "快递服务中心"
    ],
    "source": "campus-map",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:medical:hospital",
    "name": "闵行校医院",
    "kind": "medical",
    "aliases": [
      "闵行校医院",
      "校医院"
    ],
    "source": "hospital",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:landscape:siyuan",
    "name": "思源湖",
    "kind": "landscape",
    "aliases": [
      "思源湖"
    ],
    "source": "lake",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:landscape:yangsi",
    "name": "仰思坪",
    "kind": "landscape",
    "aliases": [
      "仰思坪",
      "思源湖仰思坪"
    ],
    "source": "lake",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:landscape:zhiyuan",
    "name": "致远湖",
    "kind": "landscape",
    "aliases": [
      "致远湖"
    ],
    "source": "water",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:landscape:donger",
    "name": "东二河",
    "kind": "landscape",
    "aliases": [
      "东二河"
    ],
    "source": "water",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:landscape:nansu",
    "name": "南苏园",
    "kind": "landscape",
    "aliases": [
      "南苏园"
    ],
    "source": "water",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:admin:old",
    "name": "老行政楼",
    "kind": "admin",
    "aliases": [
      "老行政楼"
    ],
    "source": "old-admin",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:admin:b",
    "name": "新行政B楼",
    "kind": "admin",
    "aliases": [
      "新行政B楼",
      "新行政楼B楼",
      "行政B楼"
    ],
    "source": "isc-visit",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:service:zijin",
    "name": "子衿街",
    "kind": "service",
    "aliases": [
      "子衿街"
    ],
    "source": "campus-map",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  },
  {
    "id": "sjtu-mh:dining:siyuan-street",
    "name": "思源美食一条街",
    "kind": "dining",
    "aliases": [
      "思源美食一条街"
    ],
    "source": "dining-extra",
    "coordinates": null,
    "checkedAt": "2026-10-23",
    "floorsVerified": false
  }
];
