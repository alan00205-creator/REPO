// Cosmetic catalogue. Prices are in 豆幣 (coins); `req` items unlock by achievement.

export const COLORS = [
  { id: 'pink', c: '#ff86c8', name: '草莓粉' },
  { id: 'yellow', c: '#ffd23f', name: '芒果黃' },
  { id: 'sky', c: '#56c2ff', name: '天空藍' },
  { id: 'mint', c: '#58dba4', name: '薄荷綠' },
  { id: 'orange', c: '#ff9a3c', name: '柳橙' },
  { id: 'grape', c: '#a77bff', name: '葡萄紫' },
  { id: 'red', c: '#ff5468', name: '番茄紅' },
  { id: 'white', c: '#f4f1ff', name: '豆花白' },
  { id: 'teal', c: '#2fc9c5', name: '青草茶' },
  { id: 'lime', c: '#b4e34b', name: '芭樂綠', price: 60 },
  { id: 'brown', c: '#b07a4f', name: '黑糖', price: 60 },
  { id: 'navy', c: '#4a5bd8', name: '深海藍', price: 60 },
  { id: 'peach', c: '#ffb1a0', name: '水蜜桃', price: 80 },
  { id: 'black', c: '#3c3a52', name: '仙草黑', price: 120 },
  { id: 'gold', c: '#ffc928', name: '金牌', req: 'crown1' },
];

export const PATTERNS = [
  { id: 0, name: '素色' },
  { id: 1, name: '條紋' },
  { id: 2, name: '圓點' },
  { id: 3, name: '雙色' },
  { id: 4, name: '肚肚' },
  { id: 5, name: '格紋', price: 80 },
  { id: 6, name: '波浪', price: 100 },
  { id: 7, name: '左右', price: 100 },
];

export const HATS = [
  { id: 'none', name: '不戴' },
  { id: 'cap', name: '棒球帽' },
  { id: 'party', name: '派對帽' },
  { id: 'cat', name: '貓耳', price: 80 },
  { id: 'bunny', name: '兔耳', price: 80 },
  { id: 'douli', name: '斗笠', price: 120 },
  { id: 'miner', name: '礦工帽', price: 120 },
  { id: 'helmet', name: '安全帽', price: 150 },
  { id: 'boba', name: '珍奶杯', price: 200 },
  { id: 'pineapple', name: '旺來頭', price: 200 },
  { id: 'chef', name: '廚師帽', price: 150 },
  { id: 'flower', name: '頭上開花', price: 180 },
  { id: 'chick', name: '小雞', price: 250 },
  { id: 'propeller', name: '竹蜻蜓', price: 250 },
  { id: 'crown', name: '冠軍皇冠', req: 'crown1' },
];

export const REQS = {
  crown1: { text: '拿到 1 頂皇冠解鎖', test: (s) => s.crowns >= 1 },
};

export const BOT_NAMES = [
  '小籠包', '鹹酥雞', '地瓜球', '蚵仔煎', '滷肉飯', '豆花', '芋圓', '鳳梨酥', '牛肉麵', '臭豆腐',
  '大腸包小腸', '蔥抓餅', '胡椒餅', '車輪餅', '粉圓', '仙草', '愛玉', '豆漿', '米漿', '油條',
  '飯糰', '蛋餅', '珍珠', '椰果', '布丁', '黑糖', '波霸', '芒果冰', '雪花冰', '芭樂',
  '蓮霧', '釋迦', '荔枝', '龍眼', '西瓜', '便當', '魯味', '燒仙草', '烤玉米', '甜不辣',
  '米血糕', '棺材板', '刈包', '肉圓', '碗粿', '筒仔米糕', '擔仔麵', '麻糬', '花生捲', '鹽酥菇',
  '雞蛋糕', '紅豆餅', '豬血湯', '貢丸', '甘蔗汁', '冬瓜茶', '酸梅湯', '杏仁露', '咖哩飯', '炒米粉',
];

export const DEFAULT_LOOK = { color: 'pink', color2: 'white', pattern: 0, hat: 'none' };

export function colorOf(id) {
  return (COLORS.find((c) => c.id === id) || COLORS[0]).c;
}

// Random but pleasant look for a bot.
export function randomLook(rng) {
  const free = COLORS.filter((c) => !c.req);
  const a = rng.pick(free);
  let b = rng.pick(free);
  if (b === a) b = COLORS[7];
  const hats = HATS.filter((h) => h.id !== 'crown');
  return {
    color: a.id,
    color2: b.id,
    pattern: rng() < 0.3 ? 0 : rng.int(1, PATTERNS.length - 1),
    hat: rng() < 0.45 ? rng.pick(hats).id : 'none',
  };
}

export function isOwned(save, kind, id) {
  const list = kind === 'color' ? COLORS : kind === 'pattern' ? PATTERNS : HATS;
  const item = list.find((x) => x.id === id);
  if (!item) return false;
  if (item.req) return REQS[item.req].test(save);
  if (!item.price) return true;
  return save.owned.includes(kind + ':' + id);
}
