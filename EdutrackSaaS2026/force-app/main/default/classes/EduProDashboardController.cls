public with sharing class EduProDashboardController {
 
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getDashboardMetrics() {
        Map<String, Object> metrics = new Map<String, Object>();
        try {
            // Aggregates for high-level stats
            List<AggregateResult> studentCounts = [SELECT COUNT(Id) total FROM Account WHERE Type = 'Student' WITH SECURITY_ENFORCED];
            metrics.put('totalStudents', studentCounts[0].get('total'));
            
            List<AggregateResult> revResults = [SELECT SUM(Total_Paid_in_this_Invoice__c) total FROM Invoice__c WHERE Status__c = 'Paid' WITH SECURITY_ENFORCED];
            metrics.put('totalRevenue', revResults[0].get('total') != null ? (Decimal)revResults[0].get('total') : 0);
            
            metrics.put('recentAdmissions', getAllRecentAdmissions());
            metrics.put('paymentOverview', getAllRecentPayments());
            
            metrics.put('avgAttendance', 85.5); // Placeholder for future logic
            metrics.put('avgAcademicScore', 78.2); // Placeholder for future logic
            
            metrics.put('studentTrend', 5.2);
            metrics.put('revenueTrend', 12.8);
            metrics.put('attendanceTrend', -1.5);
            metrics.put('scoreTrend', 2.4);
            
        } catch (Exception e) {
            System.debug('Error in getDashboardMetrics: ' + e.getMessage());
        }
        return metrics;
    }

    private static List<Map<String, String>> buildAdmissionList(List<Account> accounts) {
        List<Map<String, String>> results = new List<Map<String, String>>();
        for (Account acc : accounts) {
            results.add(new Map<String, String>{
                'id' => acc.Id,
                'name' => acc.Name,
                'rollNo' => (String)NamespaceUtils.getValue(acc, 'Roll_No__c'),
                'class' => (String)NamespaceUtils.getValue(acc, 'Class__r.Name'),
                'status' => 'Active',
                'avatar' => acc.Name != null ? acc.Name.substring(0,1).toUpperCase() : 'S'
            });
        }
        return results;
    }

    private static List<Map<String, String>> buildPaymentList(List<Invoice__c> invoices) {
        List<Map<String, String>> results = new List<Map<String, String>>();
        for (Invoice__c inv : invoices) {
            Decimal amt = (Decimal)NamespaceUtils.getValue(inv, 'Total_Paid_in_this_Invoice__c');
            if (amt == null || amt == 0) {
                Decimal paidAmt = (Decimal)NamespaceUtils.getValue(inv, 'Paid_Amount__c');
                amt = paidAmt != null ? paidAmt : 0;
            }
            
            String name = (String)NamespaceUtils.getValue(inv, 'Student__r.Name');
            if (String.isBlank(name)) {
                name = (String)NamespaceUtils.getValue(inv, 'Account__r.Name');
            }
            
            results.add(new Map<String, String>{
                'id' => inv.Id,
                'name' => name,
                'status' => (String)NamespaceUtils.getValue(inv, 'Status__c'),
                'statusClass' => 'badge-status badge-active',
                'amount' => '₹' + amt.setScale(2).toPlainString()
            });
        }
        return results;
    }

    @AuraEnabled public static List<Map<String, String>> getAllRecentAdmissions() {
        List<Account> records = [SELECT Id, Name, Roll_No__c, Class__r.Name FROM Account WHERE Type = 'Student' WITH SECURITY_ENFORCED ORDER BY CreatedDate DESC LIMIT 50];
        return buildAdmissionList((List<Account>)Security.stripInaccessible(AccessType.READABLE, records).getRecords());
    }

    @AuraEnabled public static List<Map<String, String>> getAllRecentPayments() {
        List<Invoice__c> records = [SELECT Id, Name, Status__c, Total_Paid_in_this_Invoice__c, Paid_Amount__c, Student__r.Name, Account__r.Name FROM Invoice__c WITH SECURITY_ENFORCED ORDER BY CreatedDate DESC LIMIT 50];
        return buildPaymentList((List<Invoice__c>)Security.stripInaccessible(AccessType.READABLE, records).getRecords());
    }

    @AuraEnabled(cacheable=true) public static Map<String, Object> getSchoolSetup() {
        School_Setup__c s = School_Setup__c.getOrgDefaults();
        // Custom settings don't strictly require WITH SECURITY_ENFORCED but good to handle manually if needed
        return new Map<String, Object>{
            'schoolName' => s.School_Name__c != null ? s.School_Name__c : 'EDU PRO SYSTEM', 
            'schoolLogo' => s.School_Logo__c, 
            'schoolSubtitle' => s.School_Subtitle__c != null ? s.School_Subtitle__c : 'Powered by Salesforce', 
            'isSetupCompleted' => s.Setup_Completed__c == true
        };
    }

    @AuraEnabled public static Map<String, List<Map<String, String>>> globalSearch(String searchTerm) {
        List<Map<String, String>> cr = new List<Map<String, String>>();
        if (String.isBlank(searchTerm) || searchTerm.length() < 2) return new Map<String, List<Map<String, String>>>{'results' => cr};
        String sp = '%' + searchTerm + '%';
        
        for (Account a : [SELECT Id, Name, Roll_No__c, Class__r.Name FROM Account WHERE Type = 'Student' AND (Name LIKE :sp OR Roll_No__c LIKE :sp) WITH SECURITY_ENFORCED LIMIT 5]) {
            cr.add(new Map<String, String>{'id' => a.Id, 'title' => a.Name, 'subtitle' => 'Student | ' + (String)NamespaceUtils.getValue(a, 'Class__r.Name') + ' | ' + (String)NamespaceUtils.getValue(a, 'Roll_No__c'), 'type' => 'student'});
        }
        for (Invoice__c i : [SELECT Id, Name, Student__c, Student__r.Name FROM Invoice__c WHERE Name LIKE :sp WITH SECURITY_ENFORCED LIMIT 5]) {
            cr.add(new Map<String, String>{'id' => i.Id, 'studentId' => i.Student__c, 'title' => 'Invoice ' + i.Name, 'subtitle' => 'Invoice | ' + (String)NamespaceUtils.getValue(i, 'Student__r.Name'), 'type' => 'invoice'});
        }
        return new Map<String, List<Map<String, String>>>{'results' => cr};
    }
}
