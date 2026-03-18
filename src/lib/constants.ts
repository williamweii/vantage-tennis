// Verified from https://vbs.sports.taipei/venues/?K=<id>
// Last verified: 2026-03-17
// Venues in UNLISTED_VENUES / PRACTICE_WALLS in page.tsx are static cards, not scraped.
export const VENUE_DICT: Record<number, { name: string; district: string }> = {
    // 士林區 / 大同區
    1060: { name: '百齡河濱公園(社子岸)網球場A', district: '士林區' },
    1042: { name: '百齡河濱公園(社子岸)網球場', district: '士林區' },
    324:  { name: '延平河濱公園網球場', district: '大同區' },
    // 中山區
    341:  { name: '大佳河濱運動公園網球場', district: '中山區' },
    687:  { name: '觀山河濱公園網球場', district: '中山區' },
    // 松山區
    201:  { name: '彩虹河濱公園網球場', district: '松山區' },
    // 中正區
    266:  { name: '中正河濱公園網球場', district: '中正區' },
    305:  { name: '古亭河濱公園網球場', district: '中正區' },
    352:  { name: '溪洲(福和)河濱公園網球場', district: '中正區' },
    // 萬華區
    239:  { name: '華中河濱公園網球場', district: '萬華區' },
    425:  { name: '道南河濱公園網球場4-6', district: '萬華區' },
    210:  { name: '雙園河濱公園網球場', district: '萬華區' },
    // 內湖區
    312:  { name: '成美右岸河濱公園網球場', district: '內湖區' },
    // 北投區
    174:  { name: '美堤河濱公園網球場', district: '北投區' },
};
