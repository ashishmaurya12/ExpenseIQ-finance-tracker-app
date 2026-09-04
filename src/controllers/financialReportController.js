const financialReportService = require('../services/financialReportService');

async function generateMonthlyReport(req, res, next) {
  try {
    const month = req.query?.month || req.body?.month;
    if (month && (typeof month !== 'string' || !month.match(/^\d{4}-\d{2}$/))) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_MONTH_FORMAT', message: 'Invalid "month" format. Expected YYYY-MM.' }
      });
    }

    const report = await financialReportService.generateMonthlyReport(req.user.id, month);
    res.status(200).json({
      success: true,
      report,
      ...report
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  generateMonthlyReport
};
