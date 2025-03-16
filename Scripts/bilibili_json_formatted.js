// 原作者: github @ddgksf2013
// 自用改编: github @SeanX16

const version = 'V2.0.120';

let body = $response.body;
if (body) {
  // 根据请求 URL 匹配不同情况
  switch (true) {
    // ── 1. 处理 pgc/season/app/related/recommend? 接口 ──
    case /pgc\/season\/app\/related\/recommend\?/.test($request.url):
      try {
        let t = JSON.parse(body);
        // 如果 result.cards 存在且有内容，则过滤掉 type 为 2 的卡片
        if (t.result?.cards?.length) {
          t.result.cards = t.result.cards.filter(t => 2 != t.type);
        }
        body = JSON.stringify(t);
      } catch (i) {
        console.log("bilibili recommend:" + i);
      }
      break;

    // ── 2. 处理 /x/resource/show/skin? 接口 ──
    case /^https?:\/\/app\.bilibili\.com\/x\/resource\/show\/skin\?/.test($request.url):
      try {
        let a = JSON.parse(body);
        // 删除 common_equip 属性
        delete a.data?.common_equip;
        body = JSON.stringify(a);
      } catch (e) {
        console.log("bilibili skin:" + e);
      }
      break;

    // ── 3. 处理 /x/v2/feed/index? 接口（首页信息） ──
    case /^https:\/\/app\.bilibili\.com\/x\/v2\/feed\/index\?/.test($request.url):
      try {
        let s = JSON.parse(body),
          l = [];
        // 遍历 items 数组，根据条件过滤掉广告相关内容
        for (let o of s.data.items) {
          if (!o.hasOwnProperty("banner_item")) {
            if (!(
              !o.hasOwnProperty("ad_info") &&
              o.card_goto?.indexOf("ad") === -1 &&
              ["small_cover_v2", "large_cover_v1", "large_cover_single_v9"].includes(o.card_type)
            )) {
              continue;
            } else {
              l.push(o);
            }
          }
        }
        s.data.items = l;
        body = JSON.stringify(s);
      } catch (d) {
        console.log("bilibili index:" + d);
      }
      break;

    // ── 4. 处理 /x/v2/feed/index/story? 接口（故事流） ──
    case /^https?:\/\/app\.bilibili\.com\/x\/v2\/feed\/index\/story\?/.test($request.url):
      try {
        let r = JSON.parse(body),
          b = [];
        // 遍历 items，过滤掉广告相关内容
        for (let p of r.data.items) {
          if (!p.hasOwnProperty("ad_info") && p.card_goto.indexOf("ad") === -1) {
            b.push(p);
          }
        }
        r.data.items = b;
        body = JSON.stringify(r);
      } catch (c) {
        console.log("bilibili Story:" + c);
      }
      break;

    // ── 5. 处理 /x/v{digit}/account/teenagers/status? 接口 ──
    case /^https?:\/\/app\.bilibili\.com\/x\/v\d\/account\/teenagers\/status\?/.test($request.url):
      try {
        let n = JSON.parse(body);
        // 将青少年状态设为 0（可能表示关闭相关限制）
        n.data.teenagers_status = 0;
        body = JSON.stringify(n);
      } catch (y) {
        console.log("bilibili teenagers:" + y);
      }
      break;

    // ── 6. 处理 /x/resource/show/tab 接口（标签页处理） ──
    case /^https?:\/\/app\.bilibili\.com\/x\/resource\/show\/tab/.test($request.url):
      try {
        // 定义一个 Set，用于后续过滤底部标签栏
        let u = new Set([177, 178, 179, 181, 102, 104, 106, 486, 488, 489]),
          h = JSON.parse(body);
        // 处理 tab 数据
        if (h.data?.tab) {
          var f = [];
          // 添加“直播”和“推荐”标签
          f.push(
            { id: 39, name: "直播", uri: "bilibili://live/home", tab_id: "直播tab", pos: 1 },
            { id: 40, name: "推荐", uri: "bilibili://pegasus/promo", tab_id: "推荐tab", pos: 2, default_selected: 1 }
          );
          // 根据是否包含 "pgc/home" 决定添加哪种“番剧”标签
          if (JSON.stringify(h.data.tab).indexOf("pgc/home") === -1) {
            f.push({ id: 774, name: "番剧", uri: "bilibili://following/home_activity_tab/6544", tab_id: "bangumi", pos: 3 });
          } else {
            f.push({ id: 545, name: "番剧", uri: "bilibili://pgc/home", tab_id: "bangumi", pos: 3 });
          }
          // 添加“热门”和“影视”标签
          f.push(
            { id: 41, name: "热门", uri: "bilibili://pegasus/hottopic", tab_id: "hottopic", pos: 4 },
            { id: 151, name: "影视", uri: "bilibili://pgc/cinema-tab", tab_id: "film", pos: 5 }
          );
          h.data.tab = f;
        }
        // 处理 top 和 bottom 部分
        if (h.data.top) {
          h.data.top = [
            {
              id: 481,
              icon: "http://i0.hdslb.com/bfs/archive/d43047538e72c9ed8fd8e4e34415fbe3a4f632cb.png",
              name: "消息",
              uri: "bilibili://link/im_home",
              tab_id: "消息Top",
              pos: 1
            }
          ];
        }
        if (h.data.bottom) {
          let m = h.data.bottom.filter(t => u.has(t.id));
          h.data.bottom = m;
        }
        body = JSON.stringify(h);
      } catch (g) {
        console.log("bilibili tabprocess:" + g);
      }
      break;

    // ── 7. 处理 /x/v2/account/mine 接口（我的页面处理） ──
    case /^https?:\/\/app\.bilibili\.com\/x\/v2\/account\/mine/.test($request.url):
      try {
        let v = JSON.parse(body),
          // 定义允许显示的项目 ID 集合
          /*
            396 
            397 
            398 
            399 


          */
          //allowedIds = new Set([396, 397, 398, 399, 407, 410, 402, 404, 425, 426, 427, 428, 430, 432, 433, 434, 494, 495, 496, 497, 500, 501, 2830, 3072, 3084]);
          allowedIds = new Set([396, 397, 398, 399, 407, 410, 402, 404, 425, 426, 427, 428, 430, 432, 433, 434, 494, 495, 496, 497, 500, 501, 2830, 3072, 3084]);
        // 遍历每个分区
        v.data.sections_v2.forEach((t, i) => {
          // 过滤每个分区中的 items，只保留 allowedIds 中的项
          let a = t.items.filter(t => allowedIds.has(t.id));
          v.data.sections_v2[i].items = a;
          // 重置按钮为空对象，表示去除按钮
          //v.data.sections_v2[i].button = {};
          // 删除一些属性（如标题和提示图标）
          delete v.data.sections_v2[i].be_up_title;
          delete v.data.sections_v2[i].tip_icon;
          delete v.data.sections_v2[i].tip_title;
          // 如果标题为“创作中心”（两种写法），则删除 title 和 type 属性
          if (v.data.sections_v2[i].title === "创作中心" || v.data.sections_v2[i].title === "創作中心") {
            delete v.data.sections_v2[i].title;
            delete v.data.sections_v2[i].type;
          }
        });
        // 删除 VIP 相关分区
        delete v.data.vip_section_v2;
        delete v.data.vip_section;
        // 清空 live_tip 和 answer
        if (v.data.hasOwnProperty("live_tip")) {
          v.data.live_tip = {};
        }
        if (v.data.hasOwnProperty("answer")) {
          v.data.answer = {};
        }
        // 如果 VIP 状态未激活，则强制设置为激活状态
        if (!v.data.vip.status) {
          v.data.vip.type = 2;
          v.data.vip.status = 1;
          v.data.vip.vip_pay_type = 1;
          v.data.vip.due_date = 466982416e4;
        }
        body = JSON.stringify(v);
      } catch (_) {
        console.log("bilibili mypage:" + _);
      }
      break;

    // ── 8. 处理 /xlive/app-room/v1/index/getInfoByRoom 接口（直播房间信息） ──
    case /^https?:\/\/api\.live\.bilibili\.com\/xlive\/app-room\/v1\/index\/getInfoByRoom/.test($request.url):
      try {
        let x = JSON.parse(body);
        x.data.activity_banner_info = null;
        if (x.data?.shopping_info) {
          x.data.shopping_info = { is_show: 0 };
        }
        if (x.data?.new_tab_info?.outer_list && x.data.new_tab_info.outer_list.length) {
          x.data.new_tab_info.outer_list = x.data.new_tab_info.outer_list.filter(t => 33 != t.biz_id);
        }
        body = JSON.stringify(x);
      } catch (k) {
        console.log("bilibili live broadcast:" + k);
      }
      break;

    // ── 9. 处理 /x/resource/top/activity 接口（右上角活动信息） ──
    case /^https?:\/\/app\.bilibili\.com\/x\/resource\/top\/activity/.test($request.url):
      try {
        let w = JSON.parse(body);
        if (w.data) {
          w.data.hash = "ddgksf2013";
          w.data.online.icon = "";
        }
        body = JSON.stringify(w);
      } catch (O) {
        console.log("bilibili right corner:" + O);
      }
      break;

    // ── 10. 处理 ecommerce-user/get_shopping_info 接口 ──
    case /ecommerce-user\/get_shopping_info\?/.test($request.url):
      try {
        let P = JSON.parse(body);
        if (P.data) {
          P.data = {
            shopping_card_detail: {},
            bubbles_detail: {},
            recommend_card_detail: {},
            selected_goods: {},
            h5jump_popup: []
          };
        }
        body = JSON.stringify(P);
      } catch (W) {
        console.log("bilibili shopping info:" + W);
      }
      break;

    // ── 11. 处理 /x/v2/search/square 接口（搜索历史） ──
    case /^https?:\/\/app\.bilibili\.com\/x\/v2\/search\/square/.test($request.url):
      try {
        let j = JSON.parse(body);
        j.data = { type: "history", title: "搜索历史", search_hotword_revision: 2 };
        body = JSON.stringify(j);
      } catch (q) {
        console.log("bilibili hot search:" + q);
      }
      break;

    // ── 12. 处理 /x/v2/account/myinfo? 接口 ──
    case /https?:\/\/app\.bilibili\.com\/x\/v2\/account\/myinfo\?/.test($request.url):
      try {
        let E = JSON.parse(body);
        if (!E.data.vip.status) {
          E.data.vip.type = 2;
          E.data.vip.status = 1;
          E.data.vip.vip_pay_type = 1;
          E.data.vip.due_date = 466982416e4;
        }
        body = JSON.stringify(E);
      } catch (z) {
        console.log("bilibili 1080p:" + z);
      }
      break;

    // ── 13. 处理 pgc/page/(bangumi|cinema/tab?) 接口 ──
    case /pgc\/page\/(bangumi|cinema\/tab\?)/.test($request.url):
      try {
        let B = JSON.parse(body);
        B.result.modules.forEach(t => {
          if (t.style.startsWith("banner")) {
            t.items = t.items.filter(t => t.link.indexOf("play") !== -1);
          }
          if (t.style.startsWith("function")) {
            t.items = t.items.filter(t => t.blink.indexOf("bilibili.com") === -1);
            if ([1283, 241, 1441, 1284].includes(t.module_id)) {
              t.items = [];
            }
          }
          if (t.style.startsWith("tip")) {
            t.items = [];
          }
        });
        body = JSON.stringify(B);
      } catch (I) {
        console.log("bilibili fanju:" + I);
      }
      break;

    // ── 14. 处理 /x/v2/splash/list 接口（开屏广告） ──
    case /^https:\/\/app\.bilibili\.com\/x\/v2\/splash\/list/.test($request.url):
      try {
        let R = JSON.parse(body);
        if (R.data && R.data.list) {
          for (let S of R.data.list) {
            S.duration = 0;
            S.begin_time = 2240150400;
            S.end_time = 2240150400;
          }
        }
        body = JSON.stringify(R);
      } catch (T) {
        console.log("bilibili openad:" + T);
      }
      break;

    // ── 15. 处理 /xlive/app-interface/v2/index/feed 接口 ──
    case /^https:\/\/api\.live\.bilibili\.com\/xlive\/app-interface\/v2\/index\/feed/.test($request.url):
      try {
        let A = JSON.parse(body);
        if (A.data && A.data.card_list) {
          A.data.card_list = A.data.card_list.filter(t => t.card_type !== "banner_v1");
        }
        body = JSON.stringify(A);
      } catch (C) {
        console.log("bilibili xlive:" + C);
      }
      break;

    // ── 默认情况，不做处理 ──
    default:
      $done({});
  }
  $done({ body });
} else {
  $done({});
}
