module.exports ={

    config :
    
    
         {   nom:"LBC",
            urlOffres:"https://www.leboncoin.fr/ventes_immobilieres/offres/",
            urlPattern: 'https://www.leboncoin.fr/ventes_immobilieres*'
            , START_TIME : 7 //hour
            , CRON_RESTART : "0 */2 * * *" //hours
            ,sleep_between_ads:40*1000 //15 secondes
            ,sleep_between_list:5*60*1000 //15 secondes
            ,sleep_captcha:5*60000 //15 secondes
        }

}