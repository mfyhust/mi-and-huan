export const DEMO_ACTORS={lin:{name:'林同学',role:'member',initial:'林'},zhou:{name:'周同学',role:'member',initial:'周'},volunteer:{name:'招领志愿者',role:'admin',initial:'志'}};
export function seedItems(){
  const date=new Date(Date.now()+8*3600e3).toISOString().slice(0,10);
  return [
    ['黑色保温杯','水杯','黑色','象印','图书馆','靠近一楼自习区，杯身有轻微使用痕迹。','杯底刻有 LX','图书馆服务台','bottle','zhou'],
    ['黑色随行杯','水杯','黑色','膳魔师','图书馆','在图书馆东门拾获，旋盖款。','杯盖内有星形贴纸','图书馆服务台','bottle','zhou'],
    ['白色无线耳机','耳机','白色','苹果','第一教学楼','一教二楼走廊拾获，带耳机盒。','保护套内侧有蓝色小点','一教值班处','earbuds','zhou'],
    ['深蓝色折叠伞','雨伞','蓝色','天堂','食堂','折叠伞，外侧没有图案，伞柄完好。','收纳袋里有一张空白便签','食堂服务台','umbrella','volunteer'],
    ['一串钥匙','钥匙','','','体育馆','三把金属钥匙，带一个小挂件。','挂件背面刻着字母 R','体育馆前台','keys','zhou'],
    ['高等数学教材','书本','','','第二教学楼','二教教室拾获，书页有手写笔记。','扉页写着第六组','二教值班处','book','zhou'],
    ['灰色充电宝','数码配件','灰色','小米','宿舍区','宿舍楼下长椅拾获，表面有磨痕。','侧面有三角形贴纸','宿舍服务点','charger','volunteer'],
    ['米色帆布包','包袋','米色','','图书馆','图书馆入口拾获，素色帆布款。','内袋放着一张橙色书签','图书馆服务台','bag','zhou'],
    ['黑色科学计算器','文具','黑色','卡西欧','第一教学楼','一教自习室拾获，带保护盖。','背面有一道横向划痕','一教值班处','calculator','volunteer'],
  ].map(([title,category,color,brand,location,description,privateNote,custody,art,holder])=>({title,category,color,brand,location,description,privateNote,custody,art,date,holder,status:'available',demo:true,contact:'请通过站内核实申请联系保管人'}));
}
