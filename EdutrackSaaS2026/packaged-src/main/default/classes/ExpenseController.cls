public with sharing class ExpenseController {

    /* ═══════════════════════════════════════════════════════════════
       GET EXPENSES
       ═══════════════════════════════════════════════════════════════ */
    @AuraEnabled(cacheable=false)
    public static List<Map<String, Object>> getExpenses(String category, String status, String monthFilter, Boolean showAll) {
        String query = 'SELECT Id, Name, Category__c, Amount__c, Date__c, Status__c, Description__c, Payment_mode__c FROM Expense__c';
        List<String> conditions = new List<String>();

        if (String.isNotBlank(category)) {
            conditions.add('Category__c = :category');
        }
        if (String.isNotBlank(status)) {
            conditions.add('Status__c = :status');
        }
        if (showAll != true && String.isNotBlank(monthFilter)) {
            String[] parts = monthFilter.split('-');
            Integer year = Integer.valueOf(parts[0]);
            Integer month = Integer.valueOf(parts[1]);
            conditions.add('CALENDAR_YEAR(Date__c) = :year AND CALENDAR_MONTH(Date__c) = :month');
        }

        if (!conditions.isEmpty()) {
            query += ' WHERE ' + String.join(conditions, ' AND ');
        }
        query += ' ORDER BY Date__c DESC LIMIT 1000';

        return NamespaceUtils.stripNamespaceList(Database.query(query));
    }

    /* ═══════════════════════════════════════════════════════════════
       SAVE EXPENSE
       ═══════════════════════════════════════════════════════════════ */
    @AuraEnabled
    public static Map<String, Object> saveExpense(Map<String, Object> expMap) {
        if (expMap == null) {
            throw new AuraHandledException('Expense record cannot be null.');
        }
        
        String ns = NamespaceUtils.class.getName().replace('NamespaceUtils', '').replace('.', '');
        String prefix = (String.isNotBlank(ns)) ? ns + '__' : '';
        
        Expense__c exp = new Expense__c();
        if (expMap.containsKey('Id') && String.isNotBlank((String)expMap.get('Id'))) {
            exp.Id = (Id)expMap.get('Id');
        }
        
        Map<String, Schema.SObjectField> fieldsMap = Schema.SObjectType.Expense__c.fields.getMap();
        
        for (String key : expMap.keySet()) {
            if (key == 'Id') continue;
            String fieldApiName = key;
            if (key.endsWith('__c') && !key.startsWith(prefix)) {
                fieldApiName = prefix + key;
            }
            
            Object val = expMap.get(key);
            Schema.SObjectField field = fieldsMap.get(fieldApiName);
            if (field != null && val instanceof String) {
                Schema.DisplayType dt = field.getDescribe().getType();
                if (dt == Schema.DisplayType.DATE) {
                    exp.put(fieldApiName, Date.valueOf((String)val));
                    continue;
                } else if (dt == Schema.DisplayType.DATETIME) {
                    exp.put(fieldApiName, DateTime.valueOf((String)val));
                    continue;
                } else if (dt == Schema.DisplayType.CURRENCY || dt == Schema.DisplayType.DOUBLE) {
                    exp.put(fieldApiName, Decimal.valueOf((String)val));
                    continue;
                }
            }
            exp.put(fieldApiName, val);
        }
        
        upsert exp;
        return NamespaceUtils.stripNamespace(exp);
    }

    /* ═══════════════════════════════════════════════════════════════
       DELETE EXPENSE
       ═══════════════════════════════════════════════════════════════ */
    @AuraEnabled
    public static void deleteExpense(String expId) {
        if (String.isBlank(expId)) {
            throw new AuraHandledException('Expense ID is required.');
        }
        delete [SELECT Id FROM Expense__c WHERE Id = :expId LIMIT 1];
    }

    /* ═══════════════════════════════════════════════════════════════
       GET SUMMARY (Current Month Total)
       ═══════════════════════════════════════════════════════════════ */
    @AuraEnabled(cacheable=false)
    public static Map<String, Decimal> getExpenseSummary() {
        AggregateResult currentMonth = [
            SELECT SUM(Amount__c) total 
            FROM Expense__c 
            WHERE Date__c = THIS_MONTH
        ];
        AggregateResult prevMonth = [
            SELECT SUM(Amount__c) total 
            FROM Expense__c 
            WHERE Date__c = LAST_MONTH
        ];
        AggregateResult currentYear = [
            SELECT SUM(Amount__c) total 
            FROM Expense__c 
            WHERE Date__c = THIS_YEAR
        ];

        Decimal currentTotal = (Decimal)currentMonth.get('total');
        Decimal prevTotal    = (Decimal)prevMonth.get('total');
        Decimal yearlyTotal  = (Decimal)currentYear.get('total');

        return new Map<String, Decimal>{
            'currentMonth' => currentTotal != null ? currentTotal : 0,
            'prevMonth'    => prevTotal != null ? prevTotal : 0,
            'yearly'       => yearlyTotal != null ? yearlyTotal : 0
        };
    }
}