<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#101525">
  <title>MatchLens｜影視適配分析</title>

  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: "Noto Sans TC", sans-serif;
      background: #101525;
      color: #f4f6fc;
      line-height: 1.7;
    }

    nav {
      height: 76px;
      padding: 0 8%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #ffffff15;
    }

    .logo {
      font-size: 23px;
      font-weight: 800;
      letter-spacing: 1px;
    }

    .logo span {
      color: #8b9cff;
    }

    nav a {
      color: #b9c1d5;
      text-decoration: none;
      margin-left: 25px;
      font-size: 14px;
    }

    .hero {
      min-height: 590px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 80px 20px;
      background:
        radial-gradient(ellipse at 50% 20%, #394a873b, transparent 60%);
    }

    .tag {
      color: #a6b4ff;
      border: 1px solid #6578c866;
      background: #6578c81a;
      padding: 7px 18px;
      border-radius: 30px;
      font-size: 13px;
      margin-bottom: 28px;
    }

    h1 {
      font-size: clamp(38px, 6vw, 68px);
      line-height: 1.25;
      margin-bottom: 25px;
      letter-spacing: 2px;
    }

    h1 span {
      background: linear-gradient(90deg, #92a7ff, #c3a5ff);
      -webkit-background-clip: text;
      color: transparent;
    }

    .hero p {
      max-width: 600px;
      color: #aab3c9;
      font-size: 16px;
      margin-bottom: 35px;
    }

    .primary-btn {
      display: inline-block;
      padding: 14px 35px;
      background: linear-gradient(100deg, #687df1, #9b83ed);
      color: white;
      text-decoration: none;
      border-radius: 9px;
      font-weight: 700;
      transition: .25s;
    }

    .primary-btn:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 30px #7588ff55;
    }

    section {
      padding: 75px 8%;
    }

    .section-title {
      text-align: center;
      font-size: 30px;
      margin-bottom: 12px;
    }

    .section-desc {
      text-align: center;
      color: #9ba6bd;
      margin-bottom: 45px;
      font-size: 14px;
    }

    .dimensions {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
    }

    .card {
      background: #1a2235;
      border: 1px solid #ffffff12;
      padding: 28px;
      border-radius: 14px;
      transition: .25s;
    }

    .card:hover {
      transform: translateY(-5px);
      border-color: #899aff80;
      background: #202b43;
    }

    .number {
      color: #91a4ff;
      font-size: 13px;
      margin-bottom: 14px;
      letter-spacing: 2px;
    }

    .card h3 {
      font-size: 19px;
      margin-bottom: 10px;
    }

    .card p {
      color: #9ba6bd;
      font-size: 14px;
    }

    .process {
      background: #171e30;
      text-align: center;
    }

    .steps {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      max-width: 1000px;
      margin: auto;
    }

    .step {
      padding: 25px 15px;
      border: 1px solid #ffffff15;
      border-radius: 12px;
      background: #202a40;
    }

    .step strong {
      display: block;
      color: #a6b4ff;
      font-size: 20px;
      margin-bottom: 10px;
    }

    .step p {
      color: #aab3c9;
      font-size: 13px;
    }

    .start {
      text-align: center;
      padding: 100px 20px;
    }

    .start p {
      color: #aab3c9;
      margin: 15px 0 30px;
    }

    footer {
      text-align: center;
      padding: 25px;
      border-top: 1px solid #ffffff15;
      color: #78849d;
      font-size: 12px;
    }

    @media (max-width: 768px) {
      nav {
        padding: 0 5%;
      }

      nav a {
        margin-left: 10px;
        font-size: 12px;
      }

      .dimensions {
        grid-template-columns: repeat(2, 1fr);
      }

      .steps {
        grid-template-columns: repeat(2, 1fr);
      }

      section {
        padding: 60px 6%;
      }
    }

    @media (max-width: 480px) {
      .dimensions {
        grid-template-columns: 1fr;
      }

      .logo {
        font-size: 19px;
      }
    }
  </style>
</head>

<body>

  <nav>
    <div class="logo">Match<span>Lens.</span></div>
    <div>
      <a href="#model">分析模型</a>
      <a href="#process">運作流程</a>
    </div>
  </nav>

  <header class="hero">
    <div class="tag">AI-POWERED MATCHING SYSTEM</div>

    <h1>
      不只是選擇<br>
      而是找到<span>最適合</span>
    </h1>

    <p>
      每個人都有不同的喜好與觀看需求。
      MatchLens 透過六維度適配分析，
      將主觀偏好轉化為可比較的數據，
      幫助你找到真正符合期待的影視作品與演員。
    </p>

    <a href="#model" class="primary-btn">
      探索分析模型 →
    </a>
  </header>

  <section id="model">
    <h2 class="section-title">Six-Dimension Model</h2>
    <p class="section-desc">
      六大分析維度，建立個人化適配模型
    </p>

    <div class="dimensions">

      <div class="card">
        <div class="number">01 / APPEARANCE</div>
        <h3>外型風格</h3>
        <p>分析整體形象、造型與視覺風格偏好。</p>
      </div>

      <div class="card">
        <div class="number">02 / PERSONALITY</div>
        <h3>氣質人設</h3>
        <p>分析清新、成熟、活潑等不同人物特質。</p>
      </div>

      <div class="card">
        <div class="number">03 / GENRE</div>
        <h3>作品類型</h3>
        <p>依照劇情、題材及敘事風格進行分類。</p>
      </div>

      <div class="card">
        <div class="number">04 / PERFORMANCE</div>
        <h3>表演風格</h3>
        <p>比較演出特色、自然度及表現方式。</p>
      </div>

      <div class="card">
        <div class="number">05 / EXPERIENCE</div>
        <h3>資歷區間</h3>
        <p>參考出道年資與公開作品數量。</p>
      </div>

      <div class="card">
        <div class="number">06 / VIEWING</div>
        <h3>觀看情境</h3>
        <p>考量觀看平台、片長及畫質需求。</p>
      </div>

    </div>
  </section>

  <section class="process" id="process">
    <h2 class="section-title">How It Works</h2>
    <p class="section-desc">
      從偏好輸入到個人化推薦
    </p>

    <div class="steps">
      <div class="step">
        <strong>01</strong>
        <h3>偏好問卷</h3>
        <p>蒐集使用者的六維度偏好。</p>
      </div>

      <div class="step">
        <strong>02</strong>
        <h3>特徵標籤</h3>
        <p>建立演員與作品的特徵資料。</p>
      </div>

      <div class="step">
        <strong>03</strong>
        <h3>適配計算</h3>
        <p>透過權重計算適配分數。</p>
      </div>

      <div class="step">
        <strong>04</strong>
        <h3>結果推薦</h3>
        <p>呈現排序、分數與推薦原因。</p>
      </div>
    </div>
  </section>

  <section class="start">
    <h2 class="section-title">Find Your Perfect Match.</h2>
    <p>讓數據理解你的偏好，讓選擇更有依據。</p>
    <a href="#model" class="primary-btn">開始探索</a>
  </section>

  <footer>
    © 2026 MatchLens. Multi-dimensional Matching System.
  </footer>

</body>
</html>

