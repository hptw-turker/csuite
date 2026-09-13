import { defineConfig } from 'astro/config';
import wix from '@wix/astro';
import wixHostingAdapter from '@wix/astro-wix-hosting-adapter';

// Wix Managed Headless (Astro) — resmi yapılandırma.
// Sunucu route'ları (src/pages/api/*) Wix'in barındırdığı backend worker'da çalışır;
// adaptör @wix/astro-wix-hosting-adapter, Wix CLI'ın beklediği çıktı biçimini üretir.
export default defineConfig({
  output: 'server',
  adapter: wixHostingAdapter(),
  integrations: [wix()],
});
