const chromeLauncher = require('chrome-launcher');
const chromium = require('chromium');
const CDP = require('chrome-remote-interface');
const crypto = require('crypto');
/*var e = ""
var a=crypto.createDecipheriv("aes-256-cbc", Buffer.from("03438EB3989626ACB2C723A8D7BCF276"), Buffer.from(e.iv, "hex"))
r = a.update(Buffer.from(e.encryptedData, "hex"));

console.log((r = Buffer.concat([r, a.final()]).toString()))*/
const { Headers } = require('node-fetch');
const fetch = require('node-fetch');
const atob = require('atob');
const ObjectID = require('mongodb').ObjectID
const btoa = require('btoa');
var iconv = require('iconv-lite');
const data = require('./data');
const puppeteer = require('puppeteer');
const util = require('util');
const Util = require('./util.js');
const request = require('request');
var schedule = require('node-schedule');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

var pm2 = require('pm2');

var axios = require('axios');

const config = require('./config.js').config


async function main() {
  
 try{

  ////////// LAUNCH CHROMIUM & CONFIG

  const newFlags = chromeLauncher.Launcher.defaultFlags().filter(flag => flag !== '--disable-extensions' );
  console.log(chromium.path)
  const chrome = await chromeLauncher.launch({
    ignoreDefaultFlags: true,
    port:4000,
    //chromePath:chromium.path,
    //userDataDir:'./tmp/chrome-testing',
    chromeFlags: [
      '--disable-gpu',
      '--no-first-run',
      '--no-sandbox', 
            '--window-size=1200,800',
      '--remote-debugging-port=4000' ,     
      ,   
         // '--headless',
          //  '--proxy-server=socks5://127.0.0.1:9050',
      
      
            '--auto-open-devtools-for-tabs'
    ].concat(newFlags)
 
  });

  
// Connect to it using puppeteer.connect().
const resp = await util.promisify(request)(`http://localhost:${chrome.port}/json/version`);
const {webSocketDebuggerUrl} = JSON.parse(resp.body);
const browser = await puppeteer.connect({browserWSEndpoint: webSocketDebuggerUrl});

const pages  = await browser.pages();
var page1 = null 
if(!pages) throw "No pages available in browser. Stopping Chromium." 

////////////////////////// ON FERME LES ONGLETS INUTILES

for(let i=0; i<pages.length; i++){
  if( await pages[i].url() != "about:blank")
    pages[i].close()
  else page1 = pages[i]
}
if(!page1) throw "No pages available in browser. Stopping Chromium."
 
const protocol = await CDP({ port: chrome.port });
const { DOM,
  Page,
  Emulation,
  Runtime, 
  Network } = protocol;
  Runtime.consoleAPICalled(({ args, type }) => console[type].apply(console, args.map(a => a.value)));
  const blockedResourceTypes = [
    'image',
    'media',
    'font',
    'texttrack',
    'object',
    'beacon',
    'csp_report',
    'imageset',
    'stylesheet'
  ];

  const skippedResources = [
    'quantserve',
    'adzerk',
    'doubleclick',
    'adition',
    'exelator',
    'sharethrough',
    'cdn.api.twitter',
    'google-analytics',
    'googletagmanager',
    'google',
    'fontawesome',
    'facebook',
    'analytics',
    'optimizely',
    'clicktale',
    'mixpanel',
    'zedo',
    'clicksor',
    'tiqcdn',
  ];
  await page1.setRequestInterception(true);
  await page1.on('request', request => {
    const requestUrl = request._url.split('?')[0].split('#')[0];
  
    if (
      blockedResourceTypes.indexOf(request.resourceType()) !== -1 ||
      skippedResources.some(resource => requestUrl.indexOf(resource) !== -1)
    ) {
      request.abort();
    } else {
     
      request.continue();
    }
  });

  ////////////////////////////////////
  ////// REPEATING PROCESS
  await Network.setRequestInterception({ patterns: [{ urlPattern: config.urlPattern,interceptionStage: 'HeadersReceived' }] });

  Network.requestIntercepted(async ({ interceptionId, request}) => {

    var response = await Network.getResponseBodyForInterception({ interceptionId });
   // console.log(`Intercepted ${request.url} {interception id: ${interceptionId}}` + work);
  

    console.log("START ROBOT  : ", !work)
    if(work==false){
      work=true
  
    
   var bodyData = response.base64Encoded ? atob(response.body) : response.body;
 
   let links =await Util.parseListAnnonces({ origin : ORIGIN,  bodyData : bodyData})

   //if we fail to parse then it's probably a captcha error


   
   //continue request

    
    Network.continueInterceptedRequest({
 
      interceptionId
      
    });

    

    if(links.length === 0){
      console.log("///////////////////// CAPTCHA DETECTED")
      await Util.logError({source:"ScrapperLBC",type : "ERRCAPTCHA"})
      await sleep(config.sleep_captcha)
      //log 
      //solve captcha
      

   }
 

    for(let i=0 ; i< links.length ; i++){
      try{
        //let's check first that this wasn't scrap recently
        console.log("parsedAds : \n", parsedAds)
        var duplicate = await data.DuplicatePuppeter({origin:ORIGIN , url:"https://www.leboncoin.fr"+links[i].getAttribute("href")})
        console.log("duplicate : ", duplicate)
        if(parsedAds.indexOf(links[i])<0 && duplicate<1){
          await page1.goto("https://www.leboncoin.fr"+links[i].getAttribute("href"));
          parsedAds.push(links[i])
        }
        
      }
      catch(e){
        console.log("[ERROR] Request timeout for url", links[i] )
      }
    
      console.log("----SLEEP BETWEEN ADS")
     await sleep(config.sleep_between_ads)
      
    }
    await sleep(config.sleep_between_list)
    work=false

    //try 
    for(let i=0; i<5; i++){
      try{
        await page1.goto(config.urlOffres, {waitUntil: 'networkidle2'});

        break;
      }catch(e){
        console.log("[ERROR] Request timeout for leboncoin ventes_immo")
        //await Util.logError({source:"ScrapperLBC",type : "ERRLOAD", msg : "Error loading /ventes_immobilieres/offres/ "+ e.toString()})
        await sleep(config.sleep_between_list +config.sleep_between_list*i)
      }
      
    }
    
   
  }else{
    Network.continueInterceptedRequest({
 
      interceptionId
      
    });

    if(request.url!=config.urlOffres){
    
     var bodyData = response.base64Encoded ? atob(response.body) : response.body;
     bodyData=await iconv.decode(bodyData, 'utf-8').toString()
  
  try{
  await sleep(2000)
  await page1.evaluate(_ => {
   // this will be executed within the page, that was loaded before
   document.querySelector("[data-qa-id='adview_button_phone_contact']").click()
   });

   
   await sleep(5000)
   var number = await page1.evaluate(() => {
     
    return document.querySelector("[data-qa-id='adview_number_phone_contact']").innerText;
  });
  console.log("NUMBER :" + number)
  Util.parseAnnonce({ origin : ORIGIN, bodyData : bodyData, phone:number })
}catch(e){console.log(e)
  Util.parseAnnonce({ origin : ORIGIN, bodyData : bodyData })
}
  
    }
  }
  

  });
  

   ////////////////////////////////////
  ////// INITIALISATION
    for(let i=0; i<5; i++){
      try{
        //await sleep(config.sleep_between_ads)
        await page1.goto(config.urlOffres, {waitUntil: 'networkidle2'});
        await page1.waitFor(5000)


        //click method 

        //frame methods 
        /*
        //1
        let mainFrame = await page1.mainFrame()
        let frame1=await mainFrame.$("iframe")

        //2 récupérer toutes les frames principales 
        //let frame2 = (await page1.frames())[0]
          */

        break;
      }catch(e){
        console.log("[ERROR] initalisation  : ", e.toString())
        //await Util.logError({source:"ScrapperLBC", type : "ERRINIT", msg : "Error on initialisation : "+ e.toString()})
        await sleep(config.sleep_between_list)
      }
      
    }

   
  
}catch(e){
  console.log(e)
  await Util.logError({source:"ScrapperLBC",type : "ERRFATAL", msg : "Fatal error :  "+ e.toString(), session : sessionTime})
  await sleep(config.sleep_between_ads)
  pm2.restart('node serverLbc', (err, proc) => {
  })
}
}
main()

/////////////
//////////////: SCHEDULER THAT WILL RESTART THE ROBOT
schedule.scheduleJob(config.CRON_RESTART, async function(){
    pm2.restart('node serverLbc', (err, proc) => {
  })

})



//////////////////////////////
//////////////////////// USEFUL FUNCTIONS 

const sleep = (milliseconds) => {
  console.log("sleep :",milliseconds)
  //random sleep basé sur le temps donné moyenné sur l
  return new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * milliseconds * 0.2 + milliseconds)))
}
//this one sends backs NODE LINKS and not URLS
