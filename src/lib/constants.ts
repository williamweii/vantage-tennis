// Verified from https://vbs.sports.taipei/venues/?K=<id>
// Last verified: 2026-03-11
// Note: K=827, K=117 (未開放租借), K=1017 (練習壁) are defined as static cards in page.tsx
export const VENUE_DICT: Record<number, { name: string; district: string }> = {
    // 士林區 / 大同區
    1060: { name: '百齡河濱公園(社子岸)網球場A', district: '士林區' },
    1042: { name: '百齡河濱公園(社子岸)網球場', district: '士林區' },
    324: { name: '延平河濱公園網球場', district: '大同區' },
    // 中山區
    341: { name: '大佳河濱運動公園網球場', district: '中山區' },
    687: { name: '觀山河濱公園網球場', district: '中山區' },
    // 松山區
    201: { name: '彩虹河濱公園網球場', district: '松山區' },
    984: { name: '觀海公園網球場', district: '松山區' },
    320: { name: '民權公園網球場', district: '松山區' },
    // 中正區
    266: { name: '中正河濱公園網球場', district: '中正區' },
    305: { name: '古亭河濱公園網球場', district: '中正區' },
    352: { name: '溪洲(福和)河濱公園網球場', district: '中正區' },
    // 大安區
    886: { name: '臺北網球場', district: '大安區' },
    // 信義區
    1013: { name: '蘭興公園網球場', district: '信義區' },
    624: { name: '玉成公園網球場', district: '信義區' },
    // 萬華區
    239: { name: '華中河濱公園網球場', district: '萬華區' },
    849: { name: '萬有2號公園網球場', district: '萬華區' },
    // 文山區
    1006: { name: '榮華公園網球場', district: '文山區' },
    998: { name: '復興公園網球場', district: '文山區' },
    994: { name: '大豐公園網球場', district: '文山區' },
    253: { name: '道南河濱公園網球場', district: '文山區' },
    // 內湖區
    312: { name: '成美右岸河濱公園網球場', district: '內湖區' },
    767: { name: '瑞湖公園網球場', district: '內湖區' },
    604: { name: '碧湖公園網球場', district: '內湖區' },
    // 南港區
    635: { name: '中研公園網球場', district: '南港區' },
    // 北投區
    968: { name: '天溪綠地網球場', district: '北投區' },
};
