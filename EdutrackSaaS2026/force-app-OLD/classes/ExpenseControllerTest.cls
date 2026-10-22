@isTest
private class ExpenseControllerTest {

    @testSetup
    static void setup() {
        List<Expense__c> expenses = new List<Expense__c>();
        
        // 1. Current Month Expense
        expenses.add(new Expense__c(
            Category__c = 'Maintenance',
            Amount__c = 1000,
            Date__c = Date.today(),
            Status__c = 'Paid',
            Description__c = 'Current Month Test'
        ));

        // 2. Previous Month Expense
        expenses.add(new Expense__c(
            Category__c = 'Utilities',
            Amount__c = 500,
            Date__c = Date.today().addMonths(-1),
            Status__c = 'Pending',
            Description__c = 'Previous Month Test'
        ));

        insert expenses;
    }

    @isTest
    static void testGetExpenses() {
        Test.startTest();
        // Test All
        List<Map<String, Object>> all = ExpenseController.getExpenses(null, null, null, true);
        System.assertEquals(2, all.size(), 'Should find 2 expenses total');

        // Test Category
        List<Map<String, Object>> main = ExpenseController.getExpenses('Maintenance', null, null, true);
        System.assertEquals(1, main.size(), 'Should find 1 Maintenance expense');

        // Test Status
        List<Map<String, Object>> pending = ExpenseController.getExpenses(null, 'Pending', null, true);
        System.assertEquals(1, pending.size(), 'Should find 1 Pending expense');

        // Test Month
        String month = String.valueOf(Date.today().month());
        if (month.length() == 1) month = '0' + month;
        String currentMonthStr = String.valueOf(Date.today().year()) + '-' + month;
        List<Map<String, Object>> current = ExpenseController.getExpenses(null, null, currentMonthStr, false);
        System.assertEquals(1, current.size(), 'Should find 1 current month expense');
        Test.stopTest();
    }

    @isTest
    static void testSaveExpense() {
        Map<String, Object> expMap = new Map<String, Object>{
            'Category__c' => 'Other',
            'Amount__c' => 300,
            'Date__c' => String.valueOf(Date.today()),
            'Status__c' => 'Paid'
        };

        Test.startTest();
        Map<String, Object> saved = ExpenseController.saveExpense(expMap);
        Test.stopTest();

        System.assertNotEquals(null, saved.get('Id'), 'Expense should be saved');
    }

    @isTest
    static void testDeleteExpense() {
        Expense__c exp = [SELECT Id FROM Expense__c LIMIT 1];

        Test.startTest();
        ExpenseController.deleteExpense(exp.Id);
        Test.stopTest();

        List<Expense__c> check = [SELECT Id FROM Expense__c WHERE Id = :exp.Id];
        System.assertEquals(0, check.size(), 'Expense should be deleted');
    }

    @isTest
    static void testGetExpenseSummary() {
        Test.startTest();
        Map<String, Decimal> summary = ExpenseController.getExpenseSummary();
        Test.stopTest();

        System.assert(summary.containsKey('currentMonth'), 'Should contain currentMonth');
        System.assertEquals(1000, summary.get('currentMonth'), 'Current month total should be 1000');
    }
}