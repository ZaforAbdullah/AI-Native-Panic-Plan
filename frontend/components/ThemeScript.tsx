// import Script from "next/script";
// 
// export function ThemeScript() {
//   return (
//     <Script
//       id="theme-script"
//       strategy="beforeInteractive"
//       dangerouslySetInnerHTML={{
//         __html: `(function(){try{var t=localStorage.getItem('pp-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(!t&&d))document.documentElement.classList.add('dark');}catch(e){}})();`,
//       }}
//     />
//   );
// }

import Script from "next/script";

export function ThemeScript() {
  return (
    <Script
      id="theme-script"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          (function () {
            try {
              var t = localStorage.getItem('pp-theme');
              var d = window.matchMedia('(prefers-color-scheme: dark)').matches;
                
              if (t === 'dark' || (!t && d)) {
                document.documentElement.classList.add('dark');
              }
            } catch (e) {}
          })();
                  `.trim(),
      }}
    />
  );
}
