const { Headers } = require('node-fetch');
const request = require('request');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const moment = require('moment');
const config = require('./config.js').config
 
module.exports = {

 
  origins : {LBC : 1, SeLoger : 0, BelleDemeure : 2}
  ,
  parseLyboxLBC : function(html){
 
      try{
      // var regex = /<script>\n *window.FLUX_STATE = (.*)\n<\/script>/g;
      
    
      let dom =  new JSDOM(html);
      //console.log("-- parsing dom")
      //console.log( dom.querySelectorAll("a[href*=vente]"))
    
      let matches = dom.window.document.getElementById('__NEXT_DATA__').innerHTML
    
      let obj = JSON.parse(matches);
      var compat_obj = obj.props.pageProps.ad
      }catch(e){
      var compat_obj= e
      }
    
      return  compat_obj
 
  }

  ,
mapLBC : async function(params){

  console.log("//////////mapLBC")
  
  try{
    var phone=null
    if(params.bodyData==undefined){
    var ad =  params.ad
    if(ad.has_phone){
     // phone=await this.getPhoneLbc(params.key,ad)
      
    }
    }else{
    var ad =  this.parseLyboxLBC(params.bodyData);
    }
    console.log(ad)

    //mapping 
    let rooms = ad.attributes.filter((a)=>a.key === "rooms")[0]
    rooms = rooms === undefined ? null : rooms.value 

    let transactionType = ad.attributes.filter((a)=>a.key === "immo_sell_type")[0]
    transactionType = transactionType === undefined ? null  : (transactionType.value === "old" ? 0 : 1 )


    let description_norm = ad.body.replace(/[^a-zA-Z0-9]+/g, "-")
    
    let type =  ad.attributes.filter((a)=>a.key === "real_estate_type")[0]
    type = type === undefined ? null  : type.value_label
     
    if( type.toLowerCase() === "maison")
      type = 0;
    else if( type.toLowerCase() === "appartement")
      type = 1;
    else if( type.toLowerCase() === "terrain")
      type = 4;
    else if( type.toLowerCase() === "parking")
      type = 5;
    else{
      if(description_norm.indexOf("commerc") > 0)
        type = 2;
      else if(description_norm.indexOf("immeuble") > 0)
        type = 3; 
      else type = 6
    }

    let square = ad.attributes.filter((a)=>a.key === "square")[0]
    square = square === undefined ? null  : square.value 
    square = square===null?null:parseFloat(square.replace(/\D+/g, ''))
    if(isNaN(square) || square === null){
      square = ad.body.match(/([0-9]+ *m(2|²))+/g)
      square = square === null ? null : parseFloat(square[0].replace(/\D+/g, ''))
    }

 
    let price = parseInt(ad.price==undefined? null:ad.price[0])
    /////////////////////////////
 

//ad.first_publication_date 


    ad = {
      transactionType : transactionType
      ,scored:false
      ,adId : ad.list_id
      , title : ad.subject
      , url : ad.url 
      , pictureUrl : ad.images.small_url  
      , pics:ad.images.urls
      , price : price
      , pm : parseInt(parseInt(price) / parseInt(square))
      , rooms : rooms === "null" ? 1 : parseInt(rooms)
      , type : type
      , square : square 
      , description : ad.body
      
      , location :  {
        city : ad.location.city
        , zipcode : parseInt(ad.location.zipcode)
        , department : ad.location.department_name
        , region : ad.location.region_name 
        , lat : ad.location.lat 
        , lng : ad.location.lng 
      }
      , contact : {
        name : ad.owner.name ,
        phone: params.phone!=undefined?params.phone:phone
      }
      , extractionTime : moment().tz(config.timezone).add(moment().tz(config.timezone).utcOffset(), 'm').toDate()
      , publication_date :  moment().tz(config.timezone).add(moment().tz(config.timezone).utcOffset(), 'm').toDate()
      ,origin : 1
  
    }

    console.log("-------finalAd",  ad)
  
  
    return ad
  }catch(e){
    console.log("[ERROR] parseAnnonce", e.toString())
    return null 
  }
}
, 

 parseListLBC : async function(domString){
  
  console.log("FUNC - parseListAnnonces ")

  try{

    let dom =  new JSDOM(domString);
    //console.log("-- parsing dom")
    //console.log( dom.querySelectorAll("a[href*=vente]"))
  
    console.log("--all annonces for current pages")
    let nodes = dom.window.document.querySelectorAll("a[href*='/vente'][href$='htm']");
    let links = []
    nodes.forEach((l)=>{
      //console.log(l.getAttribute("href"))  
      links.push("https://www.leboncoin.fr" + l.getAttribute("href"))
    })
    
    return nodes
}catch(e){

  console.log("[ERROR] parseListAnnonces", e.toString())
   this.logError({ type : "ERRPARSING", msg : "Error parseListAnnnonces : "+ e.toString()})
  return null
}

  //window.open(links[0].getAttribute("href"));             
}

,
parseListAnnonces : async function(params){
  if(params.origin === this.origins.LBC) return await this.parseListLBC(params.bodyData)
    
  else if (params.origin === this.origins.SeLoger) return await this.parseListSeLoger(params.bodyData)
}
,
parseAnnonce : async function(params){
  console.log("////////////// parseAnnonce", params.origin, params.url)
  let ad = null 
  if(params.origin === this.origins.LBC) ad =  await this.mapLBC(params)
    
  else if (params.origin === this.origins.SeLoger) ad = await this.mapSeLoger(params)

  else if (params.origin === this.origins.BelleDemeure) ad = await this.mapBelleDemeure(params)

  this.addAnnonce(ad)
}

, addAnnonce : function(ad){
  console.log("[FUNC] addAnnonce", new Date())
  
  if(!ad) return null
//  myHeaders.append("Content-Type", "application/json");
ad.plugin = true
try{

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    request(
      {
      url : config.apiEndpoint+'/addAnnonce',
      method :"POST",
      headers : {
        "content-type": "application/json",
      },
      body: {ad : ad, secret : "secretAddAnnoncesZebi"},
      json: true
    }
  )
          

  }catch(e){
    console.log("[ERROR] addAnnonce", e.toString())
    return null
  }
}
,
  logError : async function(params) {
   
  console.log(config.apiEndpoint)
  var requestOptions = {
    headers: { 'Content-Type': 'application/json' },
    body: { source : params.source
          ,type:params.msg
          , msg : params.msg}
  };
  
  try{

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
      request(config.apiEndpoint+'/logActivity?'
            + encodeURI("source=" + params.source
            + "&type=" + params.type
            + "&msg=" + params.msg
            )
              ,    
              {
                method : "POST",
                headers : new Headers(),
                params : { }
              }
            )
  
    }catch(e){
       
      return null
    }
}, getPhoneLbc: async function(key,ad){
  console.log("[FUNC] getPhoneLbc")
  
  if(!ad) return null
//  myHeaders.append("Content-Type", "application/json");
ad.plugin = true
try{

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
   let res= await request(
      {
      url : 'https://api.leboncoin.fr/api/utils/phonenumber.json',
      method :"POST",
      headers : {
        "content-type": "application/json",
      },
      body: {app_id : 'leboncoin_web_utils', key : key,list_id:ad.list_id,text:1},
      json: true
    }
  )
  console.log("phone "+res)
  return res
          

  }catch(e){
    console.log("[ERROR] phone", e.toString())
    return null
  }
}
,

, //fonction pour enlever les accent et mettre le texte en lower case
sansAccentLower : function(str) {
  var accent = [
      /[\300-\306]/g, /[\340-\346]/g, // A, a
      /[\310-\313]/g, /[\350-\353]/g, // E, e
      /[\314-\317]/g, /[\354-\357]/g, // I, i
      /[\322-\330]/g, /[\362-\370]/g, // O, o
      /[\331-\334]/g, /[\371-\374]/g, // U, u
      /[\321]/g, /[\361]/g, // N, n
      /[\307]/g, /[\347]/g, // C, c
  ];
  var noaccent = ['A', 'a', 'E', 'e', 'I', 'i', 'O', 'o', 'U', 'u', 'N', 'n', 'C', 'c'];

  var str = str;
  for (var i = 0; i < accent.length; i++) {
      str = str.replace(accent[i], noaccent[i]);
  }

  return str.toLowerCase();
},
  typeGood : async function(desc) {
    var descriptionNorm = await this.sansAccentLower(desc)
    let type = [
        ['maison', 'villa', 'chalet', 'gite', 'propriete', 'chateau', 'manoir', 'ferme', 'moulin', 'hotel'],
        ['appartement', 'loft', 'atelier', 'duplex', 'chambre'],
        ['local', 'commerce', 'boutique', 'bureau', 'batiment'],
        ['immeuble'],
        ['terrain'],
        ['parking'],
        ['surface', 'divers', 'peniche'],
        ['residence']
    ]

    for (let i = 0; i < type.length; i++) {
        for (let j = 0; j < type[i].length; j++) {
            if (await descriptionNorm.includes(type[i][j])) {
                return i;
            }
        }


    }
    return -1;
}


}