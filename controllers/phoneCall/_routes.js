const express = require('express');
const auth = require('../../middelwares/auth');
const phoneCall = require('./phonCall')

const router = express.Router();

router.get('/', auth, phoneCall.index)
router.get('/view/:id', auth, phoneCall.view)
router.post('/add', auth, phoneCall.add)
router.get('/history/:lid', auth, phoneCall.history)

module.exports = router