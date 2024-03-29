// controllers/userController.js

const User = require("../models/User");
const bcrypt = require("bcryptjs");
const OtpUtils = require("../utils/otpUtils");
const SMS = require("../utils/sendSms");
const Otp = require("../models/Otp");
const base_url = process.env.BASE_URL;

//function to upload only files for existing user
async function uploadFileForUser(req, res) {
  try {
    const rectoFile = req.files["recto"][0];
    const versoFile = req.files["verso"][0];
    const profilFile = req.files["profil"][0];
    const { id } = req.body;

    const user = await User.findByPk(id);
    //user.dataValues.recto = rectoFile;
    if (!user) {
      return res.status(400).json({ message: "Utilisateur n'existe pas" });
    }

    const baseUrl = base_url; // Remplacez cela par l'URL de votre serveur
    const rectoUrl = baseUrl + "/" + rectoFile.path;
    const versoUrl = baseUrl + "/" + versoFile.path;
    const profil = baseUrl + "/" + profilFile.path;

    // Mettez à jour les champs recto et verso dans la base de données
    user.recto = rectoUrl;
    user.verso = versoUrl;
    user.state = "KYC";
    user.profil = profil;
    await user.save();

    res.status(200).json({
      message: "Fichiers téléchargés avec succès",
      rectoUrl: rectoUrl,
      versoUrl: versoUrl,
      profilUrl: profil,
      user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
}

//function to registrer user with a files uploaded
async function registerWithFiles(req, res) {
  try {
    const { email, first_name, last_name, phone_number, password } = req.body;
    // Construisez l'URL complète du fichier

    const rectoFile = req.files["recto"][0];
    const versoFile = req.files["verso"][0];

    // Vérifiez si l'utilisateur existe déjà
    let user = await User.findOne({ where: { email } });
    if (user) {
      return res.status(400).json({ message: "L'utilisateur existe déjà" });
    }

    // Hash du mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);
    const otpCode = OtpUtils.generateOTP();
    // Envoyer le code OTP par e-mail
    await OtpUtils.sendOTPEmail(email, otpCode);

    const baseUrl = base_url; // Remplacez cela par l'URL de votre serveur
    const rectoUrl = baseUrl + "/" + rectoFile.path;
    const versoUrl = baseUrl + "/" + versoFile.path;

    // Enregistrez les chemins des fichiers dans la base de données
    user = await User.create({
      email,
      first_name,
      last_name,
      phone_number,
      password: hashedPassword,
      status: "INIT",
      otp_code: otpCode,
      recto: rectoUrl,
      verso: versoUrl,
    });

    // Retournez l'URL complète dans la réponse JSON
    res.status(201).json({
      message: "Utilisateur créé avec succès",
      rectoUrl: rectoUrl,
      versoUrl: versoUrl,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
}

//function that send otp to client
async function sendOtp(req, res) {
  try {
    //get email from input json
    const { email } = req.body;
    //check if user exist
    //generate otp
    const otpCode = OtpUtils.generateOTP();
    //saveOtp to database
    await Otp.create({
      receiver: email,
      otp_code: otpCode,
      canal: "email",
      status: "V",
    });
    //send Otp to user
    await OtpUtils.sendOTPEmail(email, otpCode);
    res.status(200).json({
      message: "code Otp envoyé avec succés",
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur serveur ", e });
  }
}

async function sendOtpNew(req, res) {
  try {
    //get email from input json
    const { receiver,chanel } = req.body;
    //check if user exist
    //generate otp
    const otpCode = OtpUtils.generateOTP();
    //saveOtp to database
    await Otp.create({
      receiver: receiver,
      otp_code: otpCode,
      canal: chanel,
      status: "V",
    });

    switch (chanel){
      case 'email': await OtpUtils.sendOTPEmail(receiver, otpCode);
      break;
      case 'sms' : await  SMS.sendOtpSms(receiver,otpCode)
    }

    //send Otp to user
    res.status(200).json({
      message: "code Otp envoyé avec succés",
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur serveur ", e });
  }
}

//Function that check otp validity
async function checkOtp(req, res) {
  try {
    const { email, otp_code } = req.body;

    //check user by mail
    const user = await checkUserByEmail(email);
    if (user) {
      //check validaty of otp
      const otpForUser = await Otp.findOne({
        where: { userId: user.id, otp_code: otp_code, status: "V" },
      });
      if (otpForUser) {
        //update status otp
        otpForUser.status = "I";
        otpForUser.save();
        res.status(200).json({ message: "code OTP valide" });
      } else {
        res.status(404).json({ message: "code OTP incorrect ou expiré" });
      }
    } else {
      res.status(404).json({ message: "utilisateur non trouvé" });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur serveur ", e });
  }
}

async function checkOtpPhone(req, res) {
  try {
    const { phone_number, otp_code } = req.body;

    //check user by mail
   // const user = await checkUserByEmail(email);
      //check validaty of otp
      const otpForUser = await Otp.findOne({
        where: { receiver: phone_number, otp_code: otp_code, status: "V" },
      });
      if (otpForUser) {
        //update status otp
        otpForUser.status = "I";
        otpForUser.save();
        res.status(200).json({ message: "code OTP valide" });
      } else {
        res.status(404).json({ message: "code OTP incorrect ou expiré" });
      }
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur serveur ", e });
  }
}

async function checkOtpV2( email, otp_code ) {
  try {
    const otpForUser = await Otp.findOne({
      where: { receiver: email, otp_code: otp_code, status: "V" },
    });
    if (otpForUser) {
      //update status otp
      otpForUser.status = "I";
      otpForUser.save();
      return true;
    } else {
      return false;
    }
  } catch (e) {
    console.error(e);
    return false;
  }
}
//function to check if email existe in table users
async function checkUserByEmail(email) {
  // Vérifiez si l'utilisateur existe déjà
  let user = await User.findOne({ where: { email } });
  if (user) {
    return user;
  } else {
    return false;
  }
}

async function getAllAccountKyc(req,res){
  const state = "KYC";
  let userList = await User.findAll({where: {state}});

  return res.status(200).json(userList);
}

async function validateKyc(req,res){
  const {id,validated} = req.body;
  const user = await User.findByPk(id);
  if (user){
    user.state = validated?'VERIFIED':'REJECTED';
    //user.state = "VERIFIED";
    await user.save();
    await  OtpUtils.sendAccountValidatedEmail(user.email,validated);
    return res.status(200).json({ message: "Compte utilisateur validé!" });
  }else{
    return res.status(400).json({ message: "Utilisateur non trouvé!" });
  }
}
module.exports = {
  registerWithFiles,
  uploadFileForUser,
  sendOtp,
  checkOtp,
  checkOtpV2,
  sendOtpNew,
  getAllAccountKyc,
  validateKyc,
  checkOtpPhone
};
