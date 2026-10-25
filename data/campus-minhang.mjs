import {EXTENSION_SOURCES,EXTENSION_PLACES} from './campus-minhang-extension.mjs';
// Curated place names, not a copy of campus map tiles or an official GIS export.
// IDs are ours. Aliases are application search variants, not official names.
export const CAMPUS={id:'sjtu-minhang',name:'上海交通大学闵行校区',checkedAt:'2026-10-23',coverage:'持续扩充的公开来源地点库，非全校完整GIS清单'};
export const PLACE_SOURCES={
  ...EXTENSION_SOURCES,
  dining:{title:'交大家园：2023新生美食指南',url:'https://ourhome.sjtu.edu.cn/article/1057',published:'2023-08-22'},
  libraries:{title:'上海交通大学图书馆简介',url:'https://old.lib.sjtu.edu.cn/f/content/content.shtml?id=1819',published:null},
  teaching:{title:'上海交大教育技术中心：教学楼展示',url:'https://etc.sjtu.edu.cn/3dclass/mobile/dz.html',published:null},
  sports:{title:'交大家园：闵行体育场馆盘点',url:'https://ourhome.sjtu.edu.cn/article/909',published:'2022-08-23'},
  gates:{title:'2026研考交大考点公告（搜索索引留存，正文链接现跳转）',url:'https://yzb.sjtu.edu.cn/post/3450',published:'2025-12-15',evidence:'search-index'},
};
const place=(key,name,kind,aliases,source)=>({id:'sjtu-mh:'+key,name,kind,aliases:[name,...aliases],source,coordinates:null});
const numerals=['一','二','三','四','五','六','七'];
export const CAMPUS_PLACES=[
  ...numerals.map((n,i)=>place('dining:'+(i+1),'第'+n+'餐饮大楼','dining',[
    n+'餐',(i+1)+'餐','第'+n+'食堂','第'+(i+1)+'食堂',(i+1)+'食堂','第'+(i+1)+'餐饮大楼',
  ],'dining')),
  place('dining:hale','哈乐餐厅','dining',['哈乐食堂'],'dining'),
  place('dining:yulan','玉兰苑','dining',['玉兰苑餐厅'],'dining'),
  place('library:main','闵行校区主馆','library',['主图书馆','主馆','主图','新图书馆','新图'],'libraries'),
  place('library:pao','包玉刚图书馆','library',['包玉刚馆','包图'],'libraries'),
  place('library:lee','李政道图书馆','library',['李政道馆','李图'],'libraries'),
  ...[['upper','上院'],['middle','中院'],['lower','下院'],['east-upper','东上院'],['east-middle','东中院'],['east-lower','东下院']].map(([id,name])=>place('teaching:'+id,name,'teaching',[],'teaching')),
  place('teaching:chen','陈瑞球楼','teaching',['陈瑞球'],'teaching'),
  place('sports:huo','霍英东体育中心','sports',['霍英东体育馆','霍体'],'sports'),
  place('sports:air','气膜体育中心','sports',['气膜馆'],'sports'),
  place('sports:south-indoor','南区体育馆','sports',[],'sports'),
  place('sports:hu','胡法光体育场','sports',[],'sports'),
  place('sports:east-tennis','东区网球场','sports',[],'sports'),
  place('sports:east-basketball','东区篮球场','sports',[],'sports'),
  place('sports:baseball','棒垒球场','sports',[],'sports'),
  place('sports:water','水上运动基地','sports',[],'sports'),
  place('sports:zhiyuan','致远游泳健身馆','sports',[],'sports'),
  place('sports:hu-tennis','胡晓明网球场','sports',[],'sports'),
  place('sports:south-outdoor','南区体育场','sports',[],'sports'),
  place('gate:siyuan','思源门','gate',['东川路800号校门','拖鞋门'],'gate-history'),
  place('gate:kaixuan','凯旋门','gate',['南大门','东川路600号校门'],'campus-map'),
  ...EXTENSION_PLACES,
];
