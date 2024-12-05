const express = require('express');
const dailyReport = require('./dailyReport');
const auth = require('../../middelwares/auth');

const router = express.Router();

router.get('/', auth, dailyReport.index)
router.post('/add', auth, dailyReport.add)
router.post('/all', auth, dailyReport.all)

module.exports = router