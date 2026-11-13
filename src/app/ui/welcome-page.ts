import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from "@angular/core";
import { ELEMENT_NAMES, SPECIES } from "../domain/game.js";

@Component({
  selector: "ww-welcome-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="welcome">
      <a class="skip-link" href="#welcome-content">Pular para o conteúdo</a>
      <header class="welcome-nav">
        <a class="welcome-brand" href="#welcome-content" aria-label="Choravia, início"><img class="welcome-logo" src="/brand/choravia-mark.png" width="48" height="48" alt="" /> CHORAVIA<small>ECOS DA FLORESTA</small></a>
        <nav aria-label="Navegação de apresentação">
          <a class="nav-discover" href="#welcome-ecos">Conheça os Ecos</a>
          <button class="welcome-button secondary compact" (click)="enterGame.emit()">{{ authenticated ? 'Voltar ao jogo' : 'Entrar' }} <span aria-hidden="true">↗</span></button>
        </nav>
      </header>
      <main id="welcome-content" tabindex="-1">
        <section class="welcome-hero" aria-labelledby="welcome-title">
          <div class="hero-copy">
            <p class="welcome-eyebrow"><span></span> UMA AVENTURA CHAMADA CHORAVIA</p>
            <h1 id="welcome-title" tabindex="-1">A floresta tem<br />uma história.<br /><em>A próxima é a sua.</em></h1>
            <p class="hero-description">Entre por uma trilha esquecida. Encontre criaturas extraordinárias. E descubra os vínculos que fazem este mundo despertar.</p>
            <div class="hero-actions">
              <button class="welcome-button primary" (click)="enterGame.emit()">{{ authenticated ? 'Continuar minha jornada' : 'Começar minha jornada' }} <span aria-hidden="true">→</span></button>
              <a class="welcome-text-link" href="#welcome-world">Conhecer o mundo <span aria-hidden="true">↓</span></a>
            </div>
            <p class="hero-footnote"><span aria-hidden="true">◇</span> No seu navegador. No seu ritmo.</p>
          </div>
          <div class="hero-art">
            <svg class="forest-scene" viewBox="0 0 600 660" role="img" aria-labelledby="forest-title forest-description">
              <title id="forest-title">O chamado da floresta</title>
              <desc id="forest-description">Ilustração de um Guardião acompanhado por um pequeno Eco diante de um arco luminoso, entre árvores e raízes de uma floresta.</desc>
              <defs>
                <linearGradient id="welcome-sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#254f48"/><stop offset="1" stop-color="#102a29"/></linearGradient>
                <radialGradient id="welcome-light"><stop stop-color="#d7e8b3" stop-opacity=".8"/><stop offset=".4" stop-color="#91ba91" stop-opacity=".25"/><stop offset="1" stop-color="#91ba91" stop-opacity="0"/></radialGradient>
                <linearGradient id="welcome-path" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#b9b790"/><stop offset="1" stop-color="#566652"/></linearGradient>
                <linearGradient id="welcome-portal" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#b8d4ac" stop-opacity=".55"/><stop offset="1" stop-color="#6daca2" stop-opacity=".08"/></linearGradient>
                <linearGradient id="welcome-trunk"><stop stop-color="#213d33"/><stop offset="1" stop-color="#101e20"/></linearGradient>
                <filter id="welcome-glow"><feGaussianBlur stdDeviation="6"/></filter>
                <clipPath id="welcome-frame"><path d="M300 18C455 18 574 143 574 300V620H26V300C26 143 145 18 300 18Z"/></clipPath>
                <g id="welcome-fern"><path d="M0 0Q4-30 0-56M0-15Q-22-24-25-35Q-5-33 1-20M0-27Q17-36 20-45Q4-42 1-31M0-39Q-12-46-12-54Q-1-51 0-43" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></g>
              </defs>
              <path d="M300 6C461 6 586 137 586 300V632H14V300C14 137 139 6 300 6Z" fill="none" stroke="#a6b387" stroke-opacity=".25"/>
              <g clip-path="url(#welcome-frame)">
                <path d="M0 0H600V660H0Z" fill="url(#welcome-sky)"/>
                <circle cx="313" cy="240" r="245" fill="url(#welcome-light)"/>
                <g fill="none" stroke="#91af88" stroke-opacity=".13" stroke-width="12">
                  <path d="M80 470L110 30M110 180L48 95M106 220L180 97M480 470L460 10M464 190L540 79M469 244L408 141M205 433L214 48M397 442L379 82"/>
                </g>
                <g fill="#37594b" opacity=".65"><ellipse cx="75" cy="70" rx="147" ry="92"/><ellipse cx="530" cy="90" rx="152" ry="100"/><ellipse cx="280" cy="-5" rx="200" ry="100"/></g>
                <path d="M0 422Q106 377 219 412Q348 365 600 412V660H0Z" fill="#284c3b"/>
                <path d="M-10 482Q118 421 278 460Q451 416 612 473V660H-10Z" fill="#1b3b32"/>
                <path d="M280 378C348 421 244 448 293 486C343 525 415 548 459 660H162C176 558 250 540 249 503C248 465 299 446 285 424C272 405 258 396 265 378Z" fill="url(#welcome-path)" opacity=".72"/>
                <path d="M234 396V284C234 186 362 184 362 284V396" fill="url(#welcome-portal)"/>
                <path d="M218 408V281C218 167 379 167 379 281V408" fill="none" stroke="#506f51" stroke-width="29"/>
                <path d="M227 405V282C227 184 369 184 369 282V405" fill="none" stroke="#a8b88b" stroke-opacity=".6" stroke-width="3"/>
                <path d="M217 408Q240 354 220 306M377 406Q348 360 376 315M232 227Q275 240 274 195M323 195Q319 231 367 231" fill="none" stroke="#2d503c" stroke-width="9" stroke-linecap="round"/>
                <path d="M249 280L256 272L263 280L256 288ZM334 281L341 273L348 281L341 289Z" fill="#d3dfab" opacity=".8"/>
                <circle cx="299" cy="258" r="14" fill="#dce7ab" opacity=".4" filter="url(#welcome-glow)"/>
                <path d="M299 241L307 255L299 269L291 255Z" fill="#e4ebbe"/>
                <g fill="url(#welcome-trunk)">
                  <path d="M-10-15H74C68 143 112 214 88 377C81 425 109 492 160 521C95 516 58 483 46 445C29 488 5 500-20 503Z"/>
                  <path d="M600-20H518C539 114 483 224 517 380C523 426 493 484 442 514C499 509 544 470 553 443C573 487 597 501 621 503Z"/>
                </g>
                <g fill="none" stroke="#416349" stroke-width="4" opacity=".65"><path d="M37 57C30 208 75 253 51 385M554 91C572 214 523 268 550 378"/><path d="M64 181Q124 164 160 115M532 162Q479 141 454 89" stroke-width="14"/></g>
                <g fill="#122e29"><ellipse cx="70" cy="-5" rx="190" ry="103"/><ellipse cx="-20" cy="111" rx="142" ry="87"/><ellipse cx="560" cy="-4" rx="171" ry="113"/><ellipse cx="627" cy="140" rx="124" ry="97"/></g>
                <g fill="#284936"><ellipse cx="123" cy="18" rx="115" ry="43" transform="rotate(17 123 18)"/><ellipse cx="482" cy="25" rx="112" ry="49" transform="rotate(-15 482 25)"/></g>
                <g fill="#477156" opacity=".8"><ellipse cx="58" cy="106" rx="12" ry="5" transform="rotate(25 58 106)"/><ellipse cx="509" cy="79" rx="15" ry="6" transform="rotate(-35 509 79)"/><ellipse cx="151" cy="51" rx="12" ry="5"/><ellipse cx="460" cy="54" rx="13" ry="5"/></g>
                <ellipse cx="303" cy="510" rx="32" ry="8" fill="#122c29" opacity=".6"/>
                <g stroke-linejoin="round"><path d="M287 470L285 504L294 506L301 477L305 506L315 504L312 470" fill="#26362d"/><path d="M283 450L277 482Q300 494 321 482L312 450Z" fill="#d2bb75"/><path d="M282 454L273 474L280 478L292 459M311 454L322 473L315 478L306 459" fill="#a47a59"/><rect x="288" y="431" width="22" height="24" rx="9" fill="#bc8f6b"/><path d="M286 444Q280 420 298 421Q317 419 315 442L306 435L286 440Z" fill="#29302b"/><path d="M283 451Q299 458 313 451L311 460Q297 467 284 459Z" fill="#9eb48b"/><path d="M309 464L318 480" stroke="#6c6850" stroke-width="4"/></g>
                <ellipse cx="347" cy="505" rx="18" ry="6" fill="#102c29" opacity=".65"/>
                <g><path d="M331 491Q330 477 344 477Q360 477 361 493Q363 505 347 506Q331 507 331 491Z" fill="#9bbd82"/><path d="M336 480Q324 470 329 464Q340 463 344 479M346 478Q349 461 358 463Q363 473 351 482" fill="#b4d298"/><circle cx="341" cy="491" r="2" fill="#263c2e"/><circle cx="353" cy="491" r="2" fill="#263c2e"/><path d="M343 497Q347 500 351 497" fill="none" stroke="#435c36" stroke-width="1.5" stroke-linecap="round"/></g>
                <g color="#4d7752"><use href="#welcome-fern" transform="translate(105 567) rotate(-16) scale(1.3)"/><use href="#welcome-fern" transform="translate(477 587) rotate(18) scale(1.6)"/><use href="#welcome-fern" transform="translate(55 505) rotate(-22)"/><use href="#welcome-fern" transform="translate(553 502) rotate(24)"/></g>
                <path d="M0 596Q91 547 174 595L148 660H0ZM600 584Q521 558 440 610L461 660H600Z" fill="#132c27"/>
                <g fill="#6b8d5d"><ellipse cx="124" cy="582" rx="19" ry="7" transform="rotate(-25 124 582)"/><ellipse cx="477" cy="601" rx="20" ry="7" transform="rotate(25 477 601)"/></g>
                <g class="forest-fireflies" fill="#e2d794"><circle cx="157" cy="288" r="2.5"/><circle cx="420" cy="319" r="2"/><circle cx="182" cy="392" r="3"/><circle cx="408" cy="451" r="2.5"/><circle cx="138" cy="459" r="2"/><circle cx="450" cy="214" r="2"/><circle cx="339" cy="158" r="1.5"/></g>
              </g>
              <path d="M300 18C455 18 574 143 574 300V620H26V300C26 143 145 18 300 18Z" fill="none" stroke="#c9cba2" stroke-opacity=".35"/>
            </svg>
            <div class="art-caption"><span class="caption-mark" aria-hidden="true">✧</span><div><strong>Há um chamado entre as árvores.</strong><span>Você consegue ouvir?</span></div><span class="caption-index" aria-hidden="true">CLAREIRA</span></div>
          </div>
        </section>
        <section class="world-section" id="welcome-world" aria-labelledby="world-title">
          <div class="section-intro"><p class="welcome-eyebrow">PEQUENOS PASSOS. GRANDES DESCOBERTAS.</p><h2 id="world-title">Um mundo para encontrar.<br /><em>Um vínculo para levar.</em></h2></div>
          <div class="journey-steps">
            <article><span class="step-number">01</span><span class="step-symbol" aria-hidden="true">⌁</span><h3>Siga sua curiosidade</h3><p>Atravesse clareiras, encontre passagens e desperte os segredos da floresta.</p></article>
            <article><span class="step-number">02</span><span class="step-symbol" aria-hidden="true">ϟ</span><h3>Escolha seu próximo passo</h3><p>Em batalhas por turnos, descubra a força dos elementos e o momento de defender.</p></article>
            <article><span class="step-number">03</span><span class="step-symbol" aria-hidden="true">✧</span><h3>Crie novos vínculos</h3><p>Conheça os Ecos, forme sua coleção e veja seus companheiros crescerem com você.</p></article>
          </div>
        </section>
        <section class="ecos-section" id="welcome-ecos" aria-labelledby="ecos-title">
          <div class="ecos-intro"><div><p class="welcome-eyebrow">CINCO ELEMENTOS. MUITOS CAMINHOS.</p><h2 id="ecos-title">Quem vai com você?</h2></div><p>Seu primeiro companheiro é só o começo.<br />Cada Eco tem um jeito de transformar a jornada.</p></div>
          <div class="ecos-lineup">
            @for (eco of species; track eco.id) {
              <article class="eco-profile" [style.--eco-color]="eco.color"><span class="eco-emblem" aria-hidden="true">{{ eco.glyph }}</span><small>{{ elements[eco.element] }}</small><h3>{{ eco.name }}</h3><span class="eco-rule" aria-hidden="true"></span></article>
            }
          </div>
        </section>
        <section class="closing-section" aria-labelledby="closing-title"><span class="closing-flower" aria-hidden="true">✳</span><p class="welcome-eyebrow">SEU PRIMEIRO VÍNCULO ESTÁ À ESPERA</p><h2 id="closing-title">Toda jornada começa<br />com um encontro.</h2><button class="welcome-button primary" (click)="enterGame.emit()">{{ authenticated ? 'Voltar à expedição' : 'Entrar na floresta' }} <span aria-hidden="true">→</span></button><p class="closing-note">{{ authenticated ? 'Sua expedição está vinculada à sua conta.' : 'Entre com Google para criar seu Guardião e escolher seu Eco.' }}</p></section>
      </main>
      <footer class="welcome-footer"><a class="footer-brand" href="#welcome-content"><img src="/brand/choravia-mark.png" width="32" height="32" alt="" /> CHORAVIA</a><span>Cinco caminhos. A mesma raiz.</span><small>Uma aventura em desenvolvimento.</small></footer>
    </div>
  `,
  styles: [`
    :host { display: block; color: var(--color-text); background: var(--color-bg); font-family: var(--font-body); font-size: 16px; line-height: 1.6; }
    *, *::before, *::after { box-sizing: border-box; }
    h1, h2, h3, p { margin: 0; }
    a { color: inherit; text-decoration: none; }
    button { font: inherit; cursor: pointer; }
    a:focus-visible, button:focus-visible { outline: 3px solid #ecce86; outline-offset: 5px; }
    [id] { scroll-margin-top: 28px; }
    .welcome { overflow: clip; background: radial-gradient(ellipse at 84% 13%, #33574930, transparent 42%), var(--color-bg); }
    .skip-link { position: fixed; z-index: 1000; top: 12px; left: 12px; padding: 12px 18px; background: #e7cc88; color: #132a25; border-radius: 8px; transform: translateY(-180%); }
    .skip-link:focus { transform: translateY(0); }
    .welcome-nav, main, .welcome-footer { width: min(1200px, calc(100% - 96px)); margin-inline: auto; }
    .welcome-nav { display: flex; align-items: center; justify-content: space-between; gap: 24px; min-height: 112px; border-bottom: 1px solid #afc0a426; }
    .welcome-brand { display: grid; grid-template-columns: auto 1fr; align-items: center; column-gap: 10px; font: 700 24px Georgia, "Times New Roman", serif; letter-spacing: .055em; }
    .welcome-brand > .welcome-logo { width: 48px; height: 48px; object-fit: contain; grid-row: 1 / 3; font-size: 39px; color: #e1c67f; font-weight: 400; }
    .welcome-brand small { font: 9px ui-sans-serif, sans-serif; color: #b6c2ad; letter-spacing: .23em; margin-top: 5px; }
    .welcome-nav nav { display: flex; align-items: center; gap: 36px; }
    .nav-discover { display: inline-flex; align-items: center; min-height: 44px; color: #cbd4bf; font-size: 13px; }
    .nav-discover:hover, .welcome-text-link:hover { color: #f0d99b; }
    .welcome-button { display: inline-flex; align-items: center; justify-content: center; gap: 28px; min-height: 54px; padding: 15px 24px; border-radius: 8px; border: 1px solid transparent; transition: background .18s, transform .18s; font-size: 14px; font-weight: 650; line-height: 1.4; text-align: center; letter-spacing: .01em; }
    .welcome-button.primary { background: #e5ca86; color: #172e26; box-shadow: 0 4px 22px #0001; }
    .welcome-button.primary:hover { background: #f1dba3; transform: translateY(-2px); }
    .welcome-button.secondary { color: #e5e8d5; background: #28413966; border-color: #a7ba9559; }
    .welcome-button.secondary:hover { background: #355447; }
    .welcome-button.compact { min-height: 44px; padding: 10px 18px; font-size: 13px; gap: 22px; }
    .welcome-hero { display: grid; grid-template-columns: 1.03fr 1fr; align-items: center; gap: 48px; padding-block: 58px 88px; }
    .welcome-eyebrow { color: #b7c59f; font-size: 10px; font-weight: 600; letter-spacing: .19em; line-height: 1.7; }
    .hero-copy > .welcome-eyebrow { display: flex; align-items: center; gap: 10px; margin-bottom: 25px; }
    .hero-copy > .welcome-eyebrow span { width: 6px; height: 6px; border-radius: 50%; background: #d8c284; box-shadow: 0 0 0 5px #d8c28412; flex: 0 0 auto; }
    h1 { font: 400 clamp(44px, 4.5vw, 66px)/1.13 Georgia, "Times New Roman", serif; letter-spacing: -.045em; }
    h1 em, h2 em { font-weight: 400; color: #b9caa3; }
    .hero-description { color: #bcc8b8; max-width: 385px; font-size: 15px; line-height: 1.9; margin-top: 27px; }
    .hero-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 20px 26px; margin-top: 33px; }
    .welcome-text-link { display: inline-flex; align-items: center; justify-content: space-between; gap: 18px; min-height: 44px; font-size: 13px; color: #d3dcc5; border-bottom: 1px solid #a6b88b50; }
    .hero-footnote { margin-top: 25px; font-size: 11px; color: #98ae9b; }
    .hero-footnote span { color: #d2bd7b; margin-right: 7px; }
    .hero-art { position: relative; min-width: 0; }
    .forest-scene { display: block; width: 100%; height: auto; }
    .art-caption { display: flex; align-items: center; gap: 14px; position: absolute; left: 0; right: -8px; bottom: 0; padding: 18px 22px; background: #18352fec; border: 1px solid #bac79f45; border-radius: 9px; box-shadow: 0 18px 40px #071b2338; }
    .caption-mark { color: #d7c084; font: 36px Georgia, serif; }
    .art-caption strong { display: block; font: 15px Georgia, serif; color: #e5e5ce; }
    .art-caption div > span { display: block; margin-top: 3px; font-size: 11px; color: #a7bba5; }
    .caption-index { margin-left: auto; color: #94a88c; font-size: 10px; white-space: nowrap; }
    .world-section { padding-block: 66px 75px; border-top: 1px solid #afc0a426; }
    .section-intro { display: flex; justify-content: space-between; gap: 30px; align-items: start; }
    .section-intro > p { max-width: 215px; padding-top: 10px; }
    h2 { font: 400 clamp(32px, 3vw, 42px)/1.22 Georgia, "Times New Roman", serif; letter-spacing: -.035em; }
    .section-intro h2 { width: 64%; }
    .journey-steps { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); margin-top: 48px; gap: 42px; }
    .journey-steps article { position: relative; padding-top: 22px; border-top: 1px solid #afc0a445; }
    .step-number { font-size: 10px; color: #9eb096; letter-spacing: .1em; }
    .step-symbol { display: block; margin-block: 12px 14px; color: #d2bd7b; font: 36px Georgia, serif; line-height: 1; }
    h3 { font: 400 21px/1.3 Georgia, "Times New Roman", serif; letter-spacing: -.015em; }
    .journey-steps p { margin-top: 12px; color: #afc1b1; font-size: 13px; line-height: 1.85; max-width: 310px; }
    .ecos-section { padding-block: 67px 70px; border-top: 1px solid #afc0a426; }
    .ecos-intro { display: flex; align-items: end; justify-content: space-between; gap: 32px; }
    .ecos-intro h2 { margin-top: 12px; }
    .ecos-intro > p { color: #afc1b1; font-size: 13px; line-height: 1.8; }
    .ecos-lineup { display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 24px; padding-top: 44px; }
    .eco-profile { text-align: center; min-width: 0; padding-bottom: 14px; }
    .eco-emblem { display: flex; align-items: center; justify-content: center; width: 100%; height: 126px; color: var(--eco-color); background: radial-gradient(ellipse, color-mix(in srgb, var(--eco-color) 12%, transparent), transparent 68%); font: 65px Georgia, serif; }
    .eco-profile small { display: block; margin-top: 8px; text-transform: uppercase; letter-spacing: .16em; font-size: 9px; color: var(--eco-color); }
    .eco-profile h3 { margin-top: 7px; font-size: 22px; }
    .eco-rule { display: block; width: 24px; height: 1px; background: var(--eco-color); opacity: .45; margin: 19px auto 0; }
    .closing-section { position: relative; text-align: center; padding: 65px 24px 58px; border: 1px solid #a2b79033; border-radius: 18px; background: radial-gradient(ellipse at 50% 5%, #48674b30, transparent 70%), #19352c; margin-bottom: 72px; }
    .closing-flower { display: block; font: 44px Georgia, serif; color: #d5bf7b; margin-bottom: 18px; }
    .closing-section h2 { margin-top: 16px; font-size: clamp(34px, 3.4vw, 46px); }
    .closing-section .welcome-button { margin-top: 28px; }
    .closing-note { color: #acbfa7; font-size: 11px; line-height: 1.8; margin-top: 18px; }
    .welcome-footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 18px; padding-block: 26px 34px; border-top: 1px solid #afc0a426; }
    .footer-brand { gap: 10px; font: 17px Georgia, serif; letter-spacing: .06em; color: #d7d8bc; display: inline-flex; align-items: center; min-height: 44px; }
    .welcome-footer > span { font: italic 13px Georgia, serif; color: #a7b79b; }
    .welcome-footer > small { font-size: 10px; color: #96aa97; }
    .forest-fireflies { animation: welcome-shimmer 5s ease-in-out infinite alternate; }
    @keyframes welcome-shimmer { from { opacity: .4; } to { opacity: 1; } }
    @media (min-width: 1500px) { .welcome-hero { gap: 70px; padding-block: 75px 100px; } }
    @media (max-width: 1000px) { .welcome-nav, main, .welcome-footer { width: calc(100% - 56px); } .welcome-hero { gap: 22px; padding-block: 48px 64px; } h1 { font-size: clamp(36px, 4.7vw, 50px); } .hero-copy > .welcome-eyebrow { font-size: 9px; letter-spacing: .12em; } .hero-description { font-size: 14px; } .hero-actions { gap: 12px 20px; } .hero-actions .welcome-button { padding-inline: 18px; gap: 18px; } .art-caption { padding: 14px; gap: 9px; } .art-caption strong { font-size: 13px; } .caption-index { display: none; } .journey-steps { gap: 24px; } .ecos-lineup { gap: 12px; } }
    @media (max-width: 700px) { .welcome-nav, main, .welcome-footer { width: calc(100% - 40px); } .welcome-nav { min-height: 90px; gap: 12px; } .welcome-brand { font-size: 20px; column-gap: 7px; } .welcome-brand > .welcome-logo { width: 40px; height: 40px; } .welcome-brand small { font-size: 7px; letter-spacing: .16em; } .welcome-nav nav { gap: 16px; } .nav-discover { display: none; } .welcome-hero { grid-template-columns: 1fr; gap: 42px; padding-block: 40px 50px; } .hero-copy > .welcome-eyebrow { margin-bottom: 23px; } h1 { font-size: clamp(39px, 7.7vw, 54px); } .hero-description { max-width: 440px; margin-top: 23px; } .hero-actions { margin-top: 27px; } .hero-art { width: min(420px, 100%); margin-inline: auto; } .art-caption { left: 0; right: 0; } .art-caption strong { font-size: 15px; } .world-section, .ecos-section { padding-block: 42px; } .section-intro, .ecos-intro { display: block; } .section-intro > p { max-width: none; padding-top: 0; } .section-intro h2 { width: auto; margin-top: 18px; } .journey-steps { grid-template-columns: 1fr; gap: 26px; margin-top: 32px; } .journey-steps article { padding-left: 48px; padding-top: 22px; } .step-number { position: absolute; left: 0; top: 25px; } .step-symbol { display: none; } .journey-steps p { max-width: none; margin-top: 9px; } .ecos-intro > p { margin-top: 18px; } .ecos-lineup { grid-template-columns: repeat(3, minmax(0,1fr)); gap: 16px 8px; padding-top: 28px; } .eco-emblem { height: 95px; font-size: 52px; } .eco-profile h3 { font-size: 19px; } .eco-profile small { font-size: 8px; } .closing-section { margin-top: 12px; margin-bottom: 40px; padding: 38px 16px; border-radius: 12px; } .closing-section .welcome-eyebrow { font-size: 9px; letter-spacing: .12em; } .welcome-footer { gap: 6px 18px; padding-block: 20px 26px; } .welcome-footer > small { flex-basis: 100%; } }
    @media (max-width: 380px) { .welcome-nav, main, .welcome-footer { width: calc(100% - 32px); } .welcome-brand { font-size: 17px; } .welcome-brand > .welcome-logo { width: 34px; height: 34px; } .welcome-button.compact { padding-inline: 12px; gap: 10px; font-size: 12px; } .hero-actions { align-items: stretch; flex-direction: column; } .hero-actions .welcome-button { width: 100%; } .welcome-text-link { align-self: start; } .art-caption strong { font-size: 12px; } .art-caption div > span { font-size: 10px; } .hero-footnote { font-size: 10px; } .welcome-footer > span { font-size: 12px; } }
    .welcome-brand small { font-size: 10px; letter-spacing: .12em; }
    .welcome-eyebrow, .hero-copy > .welcome-eyebrow, .closing-section .welcome-eyebrow, .eco-profile small { font-size: 11px; }
    .hero-footnote, .closing-note, .welcome-footer > small { font-size: 12px; }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }
  `],
})
export class WelcomePageComponent {
  @Input() authenticated = false;
  @Output() readonly enterGame = new EventEmitter<void>();
  readonly species = SPECIES;
  readonly elements = ELEMENT_NAMES;
}
