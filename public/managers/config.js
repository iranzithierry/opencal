export class EmbedConfig {
  constructor() {
    this.scriptElement =
      document.currentScript ||
      (() => {
        const scripts = document.getElementsByTagName("script");
        return scripts[scripts.length - 1];
      })();
    this.serverUrl = this.scriptElement.getAttribute("data-server") || "http://localhost:3000";
    this.domain = this.scriptElement.getAttribute("data-domain") || window.location.hostname;
    // check if domain is in our allowed domains list
    console.log(`Embed script config: domain=${this.domain}, server=${this.serverUrl}`);
  }
}
