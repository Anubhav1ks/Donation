//jshint esversion:6
//require npm modues

const Paytm = require('paytmchecksum');
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose=require("mongoose");
const alert = require('alert');
// const _ = require("lodash");

//<-------------------------paymentDetails------------------------------------>

const https = require("https");
const qs = require("querystring");

const checksum_lib = require("./paytm/checksum");
const config = require("./paytm/config");

const app = express();

const parseUrl = express.urlencoded({ extended: false, sub:"false" });
const parseJson = express.json({ extended: false });
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;


//EJS started
app.set('view engine', 'ejs');
// bdoy-parser started
// app.use(bodyParser.urlencoded({extended: true}));

// start for public folder of ejs modual for css and image folder and views for html files
app.use(express.static("public"));
//<-------------------------paymentDetails------------------------------------>




app.get("/", function(req , res){
  res.render("index");
});
app.get("/send", function(req , res){
  Member.find({},function(err,found){
     if(err){
       console.log(err);
     }else{
       // console.log(found);
        res.render("send", {
          member: found
         });
     }
  });
  // res.render("send");
});
app.get("/about", function(req , res){
  res.render("about");
});
app.get("/reciver", function(req , res){
  Member.find({},function(err,found){
     if(err){
       console.log(err);
     }else{
       // console.log(found);
        res.render("reciver", {
          Email: found
         });
     }
  });
});
app.get("/contact", function(req , res){
  res.render("contact");
});
app.get("/new", function(req , res){
  res.render("new");
});
app.get("/success", function(req , res){
  res.render("success");
});
app.get("/sendmoney", function(req , res){
  res.render("sendmoney");
});
app.get("/transaction", function(req , res){
  Bank.find({},function(err,found){
     if(err){
       console.log(err);
     }else{
       // console.log(found);
        res.render("transaction", {
          alltransaction: found
         });
     }
  });
  // res.render("transaction");
});







//<-------------------------database------------------------------------>
//mongoose database started for mongodb atlas conection
mongoose.connect('mongodb+srv://admin-Anubhav:test123@cluster0.6cyyy.mongodb.net/bankdb', {useNewUrlParser: true, useUnifiedTopology: true});



//database connected
const db = mongoose.connection;
// checking for connection
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log("successfully connected");
});
// database Schema
const bankSchema = new mongoose.Schema({
  name: String,
  email: String,
  number: Number,
  amount:Number,
  // status: String
});
// initialise Schema
const Bank = mongoose.model('Bank', bankSchema);








//<-------------------------database------------------------------------>

//<-------------------------paymentDetails------------------------------------>

app.post("/paynow", [parseUrl, parseJson], (req, res) => {
  // Route for making payment

  var paymentDetails = {
    amount: req.body.amount,
    customerId: req.body.name,
    customerEmail: req.body.email,
    customerPhone: req.body.phone
};
if(!paymentDetails.amount || !paymentDetails.customerId || !paymentDetails.customerEmail || !paymentDetails.customerPhone) {
    res.render("fail");
    // res.status(400).send('Payment failed');

} else {
    var params = {};
    params['MID'] = config.PaytmConfig.mid;
    params['WEBSITE'] = config.PaytmConfig.website;
    params['CHANNEL_ID'] = 'WEB';
    params['INDUSTRY_TYPE_ID'] ='Retail';
    params['ORDER_ID'] = 'TEST_'  + new Date().getTime();
    params['CUST_ID'] = 'TEST_'  + new Date().getTime();
    params['TXN_AMOUNT'] = paymentDetails.amount;
    params['CALLBACK_URL'] = 'https://anubhav1kstask-2.herokuapp.com//callback';
    params['EMAIL'] = paymentDetails.customerEmail;
    params['MOBILE_NO'] = paymentDetails.customerPhone;
    const bank = new Bank({
      name: paymentDetails.customerId,
      email: paymentDetails.customerEmail,
      number:paymentDetails.customerPhone,
      amount:paymentDetails.amount,
      // status: paymetstatus
    });
    bank.save();

    checksum_lib.genchecksum(params, config.PaytmConfig.key, function (err, checksum) {
        var txn_url = "https://securegw-stage.paytm.in/theia/processTransaction"; // for staging
        // var txn_url = "https://securegw.paytm.in/theia/processTransaction"; // for production

        var form_fields = "";
        for (var x in params) {
            form_fields += "<input type='hidden' name='" + x + "' value='" + params[x] + "' >";
        }
        form_fields += "<input type='hidden' name='CHECKSUMHASH' value='" + checksum + "' >";

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.write('<html><head><title>Merchant Checkout Page</title></head><body><center><h1>Please do not refresh this page...</h1></center><form method="post" action="' + txn_url + '" name="f1">' + form_fields + '</form><script type="text/javascript">document.f1.submit();</script></body></html>');
        res.end();
    });
}
});


app.post("/callback", (req, res) => {
  // Route for verifiying payment

  var body = '';

  req.on('data', function (data) {
     body += data;
  });

   req.on('end', function () {
     var html = "";
     var post_data = qs.parse(body);

     // received params in callback
     console.log('Callback Response: ', post_data, "\n");


     // verify the checksum
     var checksumhash = post_data.CHECKSUMHASH;
     // delete post_data.CHECKSUMHASH;
     var result = checksum_lib.verifychecksum(post_data, config.PaytmConfig.key, checksumhash);
     console.log("Checksum Result => ", result, "\n");


     // Send Server-to-Server request to verify Order Status
     var params = {"MID": config.PaytmConfig.mid, "ORDERID": post_data.ORDERID};

     checksum_lib.genchecksum(params, config.PaytmConfig.key, function (err, checksum) {

       params.CHECKSUMHASH = checksum;
       post_data = 'JsonData='+JSON.stringify(params);

       var options = {
         hostname: 'securegw-stage.paytm.in', // for staging
         // hostname: 'securegw.paytm.in', // for production
         port: 443,
         path: '/merchant-status/getTxnStatus',
         method: 'POST',
         headers: {
           'Content-Type': 'application/x-www-form-urlencoded',
           'Content-Length': post_data.length
         }
       };


       // Set up the request
       var response = "";
       var post_req = https.request(options, function(post_res) {
         post_res.on('data', function (chunk) {
           response += chunk;
         });

         post_res.on('end', function(){
           console.log('S2S Response: ', response, "\n");

           var _result = JSON.parse(response);
             if(_result.STATUS == 'TXN_SUCCESS') {
                 res.redirect("/sucess");
             }else {
                 res.render("fail");
             }
           });
       });
       // post the data
       post_req.write(post_data);
       post_req.end();
      });
     });
});
//<-------------------------paymentDetails------------------------------------>

//<-------------------------Schema for bank Details------------------------------------>

// database Schema
const memberSchema = new mongoose.Schema({
  name: String,
  email: String,
  number: Number,
  amount: Number,
  // status: String
});
// initialise Schema
const Member = mongoose.model('Member', memberSchema);

app.post("/new",[parseUrl, parseJson],function(req,res){

  const member = new Member({
  name: req.body.name,
  email:req.body.email,
  number:req.body.phone,
  amount:req.body.amount
  });
  member.save();
  res.redirect("/send");
});

app.post("/reciver",[parseUrl, parseJson],function(req,res){
  const senderemail= req.body.Semail;
  const reciveremail= req.body.Remail;
  var value= Number(req.body.amount);
  // console.log(senderemail);
  Member.findOne({email:senderemail},function(err,item){
    if(!item){
      console.log("empty");
    }else{
      // console.log(item.amount);
      var newamount=Number(item.amount-value);
      // console.log(newamount);
      Member.updateOne({email:senderemail},{$set: { amount: newamount}},function(err,res){
        if(err){
          console.log(err);
        }else{
          console.log("updates");
        }
      });
    }
  });

  Member.findOne({email:reciveremail},function(err,items){
    if(!items){
      console.log("empty");
    }else{
      // console.log(items.amount);
      var reciveramount=Number(items.amount + value);
      // console.log(reciveramount);
      Member.updateOne({email:reciveremail},{$set: { amount: reciveramount}},function(err,res){
        if(err){
          console.log(err);
        }else{
          console.log("updated");
        }
      });
    }
  });
  res.redirect("/send");
});






app.listen(PORT, function(){
  console.log("server started at port "+ PORT);
});
