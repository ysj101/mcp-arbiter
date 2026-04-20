// TypeScript 6 で side-effect CSS import の型解決が厳しくなったため、
// `import './globals.css'` 形式を受ける宣言を追加する。Next.js 15 + TS 6 の過渡期対応。
declare module '*.css';
