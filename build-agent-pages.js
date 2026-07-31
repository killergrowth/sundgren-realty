// build-agent-pages.js — generates individual agent sub-pages
// Run: node build-agent-pages.js

const fs = require('fs');
const path = require('path');

const SITE_ROOT = __dirname;

const agents = [
  {
    slug: 'joe-sundgren',
    name: 'Joe Sundgren',
    title: 'Founder &amp; Broker | Auctioneer',
    cell: '316-377-7112',
    cellTel: '3163777112',
    email: 'joe@sundgren.com',
    photo: '/images/from-live-site/agents/agent-52.jpg',
    bio: `<p>Joe Sundgren has been in the auction, real estate and appraisal business since 1977. He is the founder and broker of Sundgren Realty &amp; Auction. Through the years, Joe has sold many premier properties, including the 9,100(+) acre Frank N. Bills Living Trust Ranch, 7,000(+) acre Eaglehead Ranch, the 7,000(+) acre Dunne Ranch, the historic Ellis Ranch, Zebold Ranch, and Kanady Ranch, to name a few.</p>
<p>For many years, Joe&#8217;s auction results have topped the market on ranch, farm, hunting, and recreational properties. Sundgren Auction is experienced in selling personal property, residential real estate, farm machinery, household items, antiques, and business liquidation items.</p>
<p>Joe has lived all his life in the El Dorado area. He attended Butler Community College and then graduated from Missouri Auction School in 1976 and Kansas State University in 1977. Joe has owned cattle, quarter horses, and land in both Butler and Greenwood Counties.</p>
<p>His civic duties have included serving on the Board of Trustees of Susan B. Allen Memorial Hospital, the board of El Dorado, Inc., and being a member of the El Dorado Chamber of Commerce. Joe also regularly volunteers his professional services at local charity auctions.</p>`,
  },
  {
    slug: 'jeremy-sundgren',
    name: 'Jeremy Sundgren',
    title: 'Broker | Auctioneer | 2025 Land Star Top Producer',
    cell: '316-377-0013',
    cellTel: '3163770013',
    email: 'jeremy@sundgren.com',
    photo: '/images/from-live-site/agents/agent-27.jpg',
    bio: `<p>Jeremy Sundgren is a highly accomplished Real Estate Broker and Auctioneer, renowned for his leadership in the South-Central Kansas real estate market. He began his career in real estate while attending Kansas State University, earning his real estate license in 2000.</p>
<p>Jeremy has consistently ranked as the #1 real estate agent by sales volume in South Central Kansas, earning top honors in 2022, 2023, and 2024 according to the South-Central Kansas MLS. He has been the leading Butler County, Kansas agent in sales volume every year since 2008. His exceptional performance earned him a spot in the Wichita Business Journal&#8217;s <em>40 Under 40 Rising Stars</em> in 2011.</p>
<p>With unmatched experience in selling large agricultural and recreational properties, Jeremy has represented some of the region&#8217;s most notable land transactions, including the sale of over 160,000 acres and nearly $1 Billion in sales volume.</p>
<p>Jeremy is married to Kelsey Callaway-Sundgren, and together they have four children: Sylvie, Marigold, Dashiell and Cal. His community involvement includes serving on the Susan B. Allen Memorial Hospital Board of Trustees and the Butler County Planning and Zoning Board.</p>`,
  },
  {
    slug: 'phillip-solorio',
    name: 'Phillip Solorio',
    title: 'Real Estate Agent',
    cell: '316-323-0218',
    cellTel: '3163230218',
    email: 'phillip@sundgren.com',
    photo: '/images/from-live-site/agents/agent-36.jpg',
    bio: `<p>Phillip is a lifelong resident of El Dorado. He graduated from El Dorado High School and Butler Community College before earning his Bachelor of Science in Business Administration and Management from Wichita State University.</p>
<p>A lifelong El Dorado resident, Phillip brings deep community knowledge and local expertise to every transaction. He specializes in residential and land sales across Butler County and the surrounding South Central Kansas area.</p>`,
  },
  {
    slug: 'deanne-woodard',
    name: 'Deanne Woodard',
    title: 'Associate Broker | Team Lead &#8211; Deanne Woodard Team',
    cell: '316-323-9238',
    cellTel: '3163239238',
    email: 'deanne@sundgren.com',
    photo: '/images/from-live-site/agents/agent-18.jpg',
    bio: `<p>A proud El Dorado native, Deanne Woodard has been helping folks find their slice of Kansas since 2006. After studying Business at Butler Community College and operating a successful transcription service for a decade, she shifted gears to pursue her passion for real estate&#8212;and never looked back.</p>
<p>Her career at Sundgren Realty began with dual roles as Office Manager and Realtor, where her attention to detail and talent for client care shone through. In 2019, she earned her Broker&#8217;s license and became an Associate Broker. By 2022, she launched The Deanne Woodard Team, partnering with her husband Tad to bring personalized and professional service to every transaction.</p>
<p>Deanne&#8217;s expertise spans residential, rural residential, commercial properties, and land. Whether you&#8217;re buying a first home, selling a legacy property, or scouting the perfect acreage, Deanne brings confidence, care, and commitment to the journey.</p>
<p>She&#8217;s a member of NewSpring Church, the Kansas Board of Realtors, the National Association of Realtors, and the Realtors of South Central Kansas.</p>`,
  },
  {
    slug: 'kelsey-sundgren',
    name: 'Kelsey Sundgren',
    title: 'Realtor',
    cell: '316-244-9567',
    cellTel: '3162449567',
    email: 'kelsey@sundgren.com',
    photo: '/images/from-live-site/agents/agent-13.jpg',
    bio: `<p>Kelsey is an El Dorado native with extensive knowledge of the community and surrounding areas. She concentrates primarily on residential sales and has sold property for over 10 years in Butler, Sedgwick, and Greenwood Counties. Kelsey prides herself on her excellent communication and ability to form connections with her clients.</p>
<p>Kelsey was chosen as the 2011 Butler County Board of Realtors (BCBR) Rookie of the Year and has been a member of the President&#8217;s Club for achieving more than $2 million in sales every year since.</p>
<p>After graduating from El Dorado High School, Kelsey attended Kansas State University where she majored in Animal Science &amp; Industry, graduating Summa Cum Laude in May 2009. She served as Chapter President of Pi Beta Phi sorority and received dean&#8217;s honor roll honors for eight consecutive semesters with a 4.0 GPA.</p>
<p>Kelsey and husband Jeremy Sundgren have four children: Sylvie, Marigold, Dashiell, and Cal. Her memberships include the National Board of Realtors, Kansas Association of Realtors, and South Central Kansas MLS.</p>`,
  },
  {
    slug: 'rick-remsberg',
    name: 'Rick Remsberg',
    title: 'Auctioneer &amp; Realtor',
    cell: '316-322-5391',
    cellTel: '3163225391',
    email: 'rick@sundgren.com',
    photo: '/images/from-live-site/agents/agent-43.jpg',
    bio: `<p>Rick has been an auctioneer/real estate agent since 1999. Rick knows and understands both the rural and residential market. His auction experience includes horse and livestock auctions, estate auctions, coin/gun auctions, farm machinery auctions, numerous charity auctions, consignment auctions and business liquidations. Rick loves the challenge of finding a way to &#8220;make the deal work.&#8221;</p>
<p>He has a passion for college football, and enjoys attending OU games and spending time with his two daughters, Candis and Jordan, son-in-law Steven, and grandson Patrick. Rick has lived in Butler County all his life and makes a good part of his living as a rancher in the Flint Hills. He attends Christ Church.</p>
<p>Rick received his BSE in Secondary Education from Emporia State University with an MS in School Counseling.</p>`,
  },
  {
    slug: 'barrett-simon',
    name: 'Barrett Simon',
    title: 'Auctioneer &amp; Realtor',
    cell: '316-452-1792',
    cellTel: '3164521792',
    email: 'barrett@sundgren.com',
    photo: '/images/from-live-site/agents/agent-39.jpg',
    bio: `<p>A native of Butler County, Barrett graduated from Flinthills High School before earning Animal Science degrees from both Butler Community College and Kansas State University. While in attendance, he was a member of nationally competitive livestock judging teams and was named the 2016 High Individual at the National Meat Animal Evaluation Contest.</p>
<p>Since earning his degree, Barrett has spent time working with ranches on both a state and national scale, seeing grazing systems and forage management practices through many diverse production systems. Additionally, Barrett works on his family&#8217;s multi-generation Flint Hills ranch and brings passion for grazing, ranchland, and other rural properties to the Sundgren Realty team.</p>
<p>As an auctioneer, Barrett also works in both commercial and purebred cattle sales and believes strongly in the auction method of marketing. He is a member of St. John&#8217;s Catholic Church in El Dorado and volunteers for the Butler County Youth Livestock Foundation.</p>`,
  },
  {
    slug: 'audrey-reese',
    name: 'Audrey Reese',
    title: 'Office Manager / Realtor',
    cell: '316-708-1587',
    cellTel: '3167081587',
    email: 'realty@sundgren.com',
    photo: '/images/from-live-site/agents/agent-44.jpg',
    bio: `<p>Audrey is our Office Manager-turned-Realtor who enjoys getting to know people through the home buying and selling process. As a Realtor, she is responsible for being responsive to your needs, and her goal is simple &#8212; to work hard to make the process as seamless as possible for her clients.</p>
<p>Audrey grew up in McPherson, Kansas. She graduated from McPherson High School and Maple Woods Community College Veterinary Technician Program. She has lived in El Dorado for the last 12 years with her husband Ty, who is a Baseball Coach at Butler Community College, and their two girls, Charlee and Bonnie.</p>
<p>When she isn&#8217;t working, you will find Audrey spending time with her family, enjoying time outdoors, and cheering on the Butler Grizzlies!</p>`,
  },
  {
    slug: 'ashleigh-casper',
    name: 'Ashleigh Casper',
    title: 'Realtor',
    cell: '620-583-9879',
    cellTel: '6205839879',
    email: 'ashleigh@sundgren.com',
    photo: '/images/from-live-site/agents/agent-thumbnail_69.jpg',
    bio: `<p>A native of Greenwood County, Ashleigh graduated from Eureka High School in 2018. She then studied at Butler Community College before earning her Bachelor of Science degree in Business Marketing and Management with honors from Wichita State University. Ashleigh has been a licensed Kansas Real Estate Agent since 2022.</p>
<p>Growing up in the Flint Hills, Ashleigh spent most of her time helping her father manage Casper Ranch. She is an avid whitetail hunter and loves bringing her 1971 Buick Skylark Convertible to local car shows.</p>
<p>Ashleigh is always excited to learn and strives to provide a quality service to her buyers and sellers. From first time home buyers to investors, she has worked with them all and can&#8217;t wait to help you achieve your real estate goals.</p>`,
  },
  {
    slug: 'yousef-jesri',
    name: 'Yousef Jesri',
    title: 'Realtor',
    cell: '316-686-1593',
    cellTel: '3166861593',
    email: 'yousef@sundgren.com',
    photo: '/images/from-live-site/agents/agent-Yousef.jpg',
    bio: `<p>Yousef was born in Wichita and has resided in Sedgwick County ever since. He has worked for his family business as long as he can remember and is currently attending classes at Wichita State University.</p>
<p>With deep community roots in Sedgwick County and a strong work ethic built through years of family business experience, Yousef brings dedication and a personal touch to every client relationship.</p>`,
  },
  {
    slug: 'tad-woodard',
    name: 'Tad Woodard',
    title: 'Realtor',
    cell: '316-323-7225',
    cellTel: '3163237225',
    email: 'tad@sundgren.com',
    photo: '/images/from-live-site/agents/agent-Head-shots-new-8.jpg',
    bio: `<p>A proud Butler County native and Bluestem High School graduate, Tad spent 18 years with Westar Energy/Evergy before branching out to pursue his entrepreneurial passions. He launched 5W LandWerx, LLC, offering pasture clearing, skid steer work, and land management services.</p>
<p>Tad partners with his wife Deanne as part of the Deanne Woodard Team of Sundgren Realty, bringing a practical, boots-on-the-ground approach to rural property. His background in land management and deep Butler County roots make him a natural fit for buyers and sellers of rural and agricultural properties.</p>`,
  },
  {
    slug: 'erin-jones',
    name: 'Erin Jones',
    title: 'Realtor',
    cell: '620-583-2775',
    cellTel: '6205832775',
    email: 'erin@sundgren.com',
    photo: '/images/from-live-site/agents/agent-Erin-Headshot-1.jpg',
    bio: `<p>Erin is a proud Greenwood County native who is passionate about helping people achieve their dreams of homeownership. After graduating from Eureka High School, she earned her Associate of Applied Science degree from Labette Community College.</p>
<p>Erin is committed to helping clients find their home in the state she proudly calls home. She believes that whether it&#8217;s finding a dream home, a first home, or the right investment property, each step matters, and she is committed to making the process as smooth and enjoyable as possible. Erin currently lives in Sedgwick County and is ready to assist buyers and sellers both near and far with confidence, care, and unwavering dedication.</p>`,
  },
  {
    slug: 'steven-hall',
    name: 'Steven Hall',
    title: 'Realtor',
    cell: '316-252-5409',
    cellTel: '3162525409',
    email: 'steven@sundgren.com',
    photo: '/images/from-live-site/agents/agent-thumbnail_66.jpg',
    bio: `<p>Meet Steven, a passionate and dedicated real estate professional who is thrilled to embark on this exciting journey with you. With a lifelong love for homes and a deep understanding of the local market, Steven is committed to helping you find your dream home or sell your property with ease.</p>
<p>As a natural people person, Steven takes pride in building strong relationships with clients, ensuring that their unique needs and goals are met every step of the way. With a knack for effective communication, Steven is known for his ability to listen attentively, provide valuable insights, and guide clients toward making informed decisions.</p>
<p>Whether you&#8217;re a first-time homebuyer, a seasoned investor, or looking to sell your property, Steven is here to provide personalized guidance, expert negotiation skills, and a seamless experience tailored to your specific needs.</p>`,
  },
  {
    slug: 'susan-sundgren-worrell',
    name: 'Susan Sundgren Worrell',
    title: 'Associate Broker',
    cell: '316-841-8469',
    cellTel: '3168418469',
    email: 'susan@sundgren.com',
    photo: '/images/from-live-site/agents/agent-susan.jpg',
    bio: `<p>Susan has been selling real estate since 2002 and holds a Kansas broker&#8217;s license. She takes a personal interest in her buyers and sellers, whether a first time home buyer or an experienced landowner. She works in all areas of real estate, from urban to rural.</p>
<p>Married and the mother of four grown children, Susan and her husband Steve reside in East Wichita and own a farm and land in Butler County. Susan received her formal education at El Dorado High School, Butler County Community College, and the University of Kansas, where she earned a B.S. degree in Nursing.</p>
<p>Her memberships include the National Association of Realtors, Kansas Association of Realtors, Realtors of South Central Kansas, Junior League of Wichita, and YMCA.</p>`,
  },
  {
    slug: 'tyler-nordman',
    name: 'Tyler Nordman',
    title: 'Director of Marketing',
    cell: null,
    cellTel: null,
    email: 'tyler@sundgren.com',
    photo: '/images/from-live-site/agents/agent-Nordman-Tyler.jpg',
    bio: `<p>With a dynamic background in college sports administration and creative media, Tyler brings a unique perspective to the team at Sundgren Realty. Passionate about storytelling and brand development, he leverages his experience in high-energy environments to craft compelling marketing strategies that resonate with clients and elevate the Sundgren Realty brand.</p>
<p>Prior to joining the Sundgren Realty team, Tyler spent 12 years working in higher education, most recently at Butler Community College as the Director of Creative Media. He grew up in Augusta, KS and graduated from Augusta High School before earning his Bachelor of Communication from Newman University in 2011.</p>
<p>Outside of work, Tyler enjoys spending time with his wife Stephanie and their two sons Tucker and Boston. Tyler and his boys love hunting, golf, and all things sports.</p>`,
  },
];

// Read partials
function readFile(p) {
  const buf = fs.readFileSync(p);
  const start = (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) ? 3 : 0;
  return buf.slice(start).toString('utf8');
}

const header = readFile(path.join(SITE_ROOT, '_partials/header.html'));
const footer = readFile(path.join(SITE_ROOT, '_partials/footer.html'));

function buildAgentPage(agent) {
  const cellHtml = agent.cell
    ? `<li><i class="fas fa-phone"></i><a href="tel:${agent.cellTel}">Cell: (${agent.cell.replace(/-/g, function(m,o){return o===3?') ':o===7?'-':m})})</a></li>`
    : '';

  // Format cell nicely
  const cellFormatted = agent.cell
    ? `(${agent.cell.substring(0,3)}) ${agent.cell.substring(4,7)}-${agent.cell.substring(8)}`
    : null;

  const cellListItem = cellFormatted
    ? `<li><i class="fas fa-phone"></i><a href="tel:${agent.cellTel}">Cell: ${cellFormatted}</a></li>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${agent.name} | Sundgren Realty &amp; Auction | El Dorado, KS</title>
  <meta name="description" content="Meet ${agent.name}, ${agent.title.replace(/&amp;/g,'&').replace(/&#8211;/g,'-')} at Sundgren Realty &amp; Auction in El Dorado, KS.">
  <meta name="robots" content="noindex, nofollow">
  <link rel="canonical" href="https://sundgrenrealty.com/agents/${agent.slug}/">
  <meta property="og:title" content="${agent.name} | Sundgren Realty &amp; Auction">
  <meta property="og:description" content="${agent.name}, ${agent.title.replace(/&amp;/g,'&').replace(/&#8211;/g,'-')} at Sundgren Realty &amp; Auction, El Dorado, KS.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://sundgrenrealty.com/agents/${agent.slug}/">
  <meta property="og:site_name" content="Sundgren Realty &amp; Auction">
  <meta name="twitter:card" content="summary_large_image">
  <meta property="og:image" content="https://sundgren-realty.pages.dev/images/og-preview.png">
  <meta property="og:image:secure_url" content="https://sundgren-realty.pages.dev/images/og-preview.png">
  <meta property="og:image:width" content="2048">
  <meta property="og:image:height" content="1152">
  <meta name="twitter:image" content="https://sundgren-realty.pages.dev/images/og-preview.png">
  <!-- SCHEMA:BreadcrumbList -->
  <link rel="icon" href="/images/favicon.png" type="image/png" media="(prefers-color-scheme: dark)">
  <link rel="icon" href="/images/sun-favicon-dark.png" type="image/png" media="(prefers-color-scheme: light)">
  <link rel="apple-touch-icon" href="/images/apple-touch-icon.svg">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" crossorigin="anonymous">
  <link rel="stylesheet" href="/css/sundgren.css">
  <style>
    .agent-profile-wrap {
      display: grid;
      grid-template-columns: 300px 1fr;
      gap: 48px;
      align-items: start;
    }
    @media (max-width: 768px) {
      .agent-profile-wrap { grid-template-columns: 1fr; }
    }
    .agent-profile-photo {
      width: 100%;
      border-radius: 8px;
      box-shadow: 0 4px 24px rgba(0,0,0,.12);
      display: block;
    }
    .agent-profile-contact-card {
      background: var(--bg-light);
      border-radius: 8px;
      padding: 20px;
      margin-top: 20px;
    }
    .agent-profile-contact-card h3 {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: .06em;
      color: var(--text-light);
      margin: 0 0 12px;
    }
    .agent-profile-contacts {
      list-style: none;
      padding: 0;
      margin: 0 0 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .agent-profile-contacts li {
      font-size: 14px;
      color: var(--dark);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .agent-profile-contacts li i { color: var(--yellow); font-size: 14px; width: 16px; flex-shrink: 0; }
    .agent-profile-contacts a { color: var(--dark); text-decoration: none; font-weight: 600; }
    .agent-profile-contacts a:hover { color: var(--primary); }
    .agent-profile-bio h1 {
      font-family: var(--font-serif);
      font-size: 32px;
      margin: 0 0 6px;
    }
    .agent-profile-bio .agent-profile-role {
      font-size: 15px;
      color: var(--text-light);
      margin: 0 0 24px;
      font-style: italic;
    }
    .agent-profile-bio p {
      font-size: 15px;
      line-height: 1.8;
      color: var(--text);
      margin: 0 0 16px;
    }
  </style>
</head>
<body>

${header}

<main>

  <section class="page-hero">
    <div class="inner">
      <h1 style="font-size:clamp(22px,4vw,36px);">${agent.name}</h1>
      <nav aria-label="Breadcrumb">
        <ol class="breadcrumb">
          <li><a href="/">Home</a></li>
          <li><a href="/agents/">Agents</a></li>
          <li class="active">${agent.name}</li>
        </ol>
      </nav>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="agent-profile-wrap">

        <div>
          <img src="${agent.photo}" alt="${agent.name} - ${agent.title.replace(/&amp;/g,'&').replace(/&#8211;/g,'-')}" class="agent-profile-photo">
          <div class="agent-profile-contact-card">
            <h3>Contact</h3>
            <ul class="agent-profile-contacts">
              ${cellListItem}
              <li><i class="fas fa-building"></i><a href="tel:3163217112">Office: (316) 321-7112</a></li>
              <li><i class="fas fa-envelope"></i><a href="mailto:${agent.email}">${agent.email}</a></li>
            </ul>
            <a href="mailto:${agent.email}" class="btn-primary" style="display:block;text-align:center;padding:12px 20px;">Send a Message <i class="fas fa-paper-plane" style="margin-left:6px;"></i></a>
          </div>
        </div>

        <div class="agent-profile-bio">
          <h1>${agent.name}</h1>
          <p class="agent-profile-role">${agent.title}</p>
          ${agent.bio}
          <div style="margin-top:28px;">
            <a href="/agents/" style="color:var(--text-light);font-size:14px;text-decoration:none;"><i class="fas fa-arrow-left" style="margin-right:6px;"></i>Back to All Agents</a>
          </div>
        </div>

      </div>
    </div>
  </section>

</main>

${footer}

</body>
</html>`;
  return html;
}

// Write agent sub-pages to source
for (const agent of agents) {
  const dir = path.join(SITE_ROOT, 'agents', agent.slug);
  fs.mkdirSync(dir, { recursive: true });
  const html = buildAgentPage(agent);
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
  console.log(`  Built agent: /agents/${agent.slug}/`);
}

console.log(`\nDone. ${agents.length} agent pages written.`);
console.log('Now run: node build.js to rebuild dist/');
