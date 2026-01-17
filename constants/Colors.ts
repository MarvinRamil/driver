// Primary Brand Yellow: #FFCD36
const BRAND_YELLOW = '#FFCD36';
const tintColorLight = BRAND_YELLOW;
const tintColorDark = BRAND_YELLOW;

export default {
  light: {
    // Primary Background: #FFFFFF - Clean, neutral, maximum readability
    background: '#FFFFFF',
    // Primary Text: #212121 - Strong contrast on white
    text: '#212121',
    tint: tintColorLight,
    tabIconDefault: '#616161',
    tabIconSelected: BRAND_YELLOW,
  },
  dark: {
    // Primary Background: #121212 - Main app background
    background: '#121212',
    // Primary Text: #FFFFFF - High contrast on dark
    text: '#FFFFFF',
    tint: tintColorDark,
    tabIconDefault: '#BDBDBD',
    tabIconSelected: BRAND_YELLOW,
  },
};
