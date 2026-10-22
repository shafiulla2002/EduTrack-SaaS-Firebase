public without sharing class PromotionController {

    public class StudentWrapper {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public String studentId;
        @AuraEnabled public String avatar;
        @AuraEnabled public Decimal pendingBalance;

        public StudentWrapper(Account acc, Decimal balance) {
            this.id = acc.Id;
            this.name = acc.Name;
            this.studentId = acc.Roll_No__c;
            this.avatar = (acc.FirstName != null ? acc.FirstName.substring(0,1) : '') +
                          (acc.LastName != null ? acc.LastName.substring(0,1) : '');
            this.pendingBalance = balance;
        }
    }

    @AuraEnabled
    public static List<StudentWrapper> getStudentsForPromotion(String academicYear, String className, String sectionName) {
        Set<Id> studentIdsWithOpp = new Set<Id>();
        for (Opportunity opp : [SELECT AccountId FROM Opportunity WHERE Academic_Year__c = :academicYear AND IsClosed = false]) {
            studentIdsWithOpp.add(opp.AccountId);
        }
        if (studentIdsWithOpp.isEmpty()) return new List<StudentWrapper>();

        String query = 'SELECT Id, Name, FirstName, LastName, Roll_No__c, Class__c FROM Account WHERE Type = \'Student\' AND Id IN :studentIdsWithOpp ';
        if (String.isNotBlank(className) && className != 'ALL') {
            query += 'AND Class__c = :className ';
        }
        if (String.isNotBlank(sectionName)) {
            query += 'AND Section__c = :sectionName ';
        }
        query += 'ORDER BY Name ASC';

        List<Account> students = Database.query(query);
        Set<Id> studentIds = new Map<Id, Account>(students).keySet();

        Map<Id, Decimal> balanceMap = new Map<Id, Decimal>();
        for(AggregateResult ar : [SELECT Opportunity.AccountId accId, SUM(TotalPrice) total
                                  FROM OpportunityLineItem
                                  WHERE Opportunity.AccountId IN :studentIds
                                  AND Opportunity.IsClosed = false
                                  GROUP BY Opportunity.AccountId]) {
            Decimal t = (Decimal)ar.get('total');
            balanceMap.put((Id)ar.get('accId'), t != null ? t : 0);
        }

        for(AggregateResult ar : [SELECT Invoice__r.Student__c studentId, SUM(Amount__c) total
                                  FROM Invoice_Item__c
                                  WHERE Invoice__r.Student__c IN :studentIds
                                  AND Invoice__r.Opportunity__r.IsClosed = false
                                  AND Invoice__r.Status__c != 'Cancelled'
                                  GROUP BY Invoice__r.Student__c]) {
            Id sid = (Id)ar.get('studentId');
            Decimal paid = (Decimal)ar.get('total');
            Decimal current = balanceMap.containsKey(sid) ? balanceMap.get(sid) : 0;
            balanceMap.put(sid, current - (paid != null ? paid : 0));
        }

        List<StudentWrapper> results = new List<StudentWrapper>();
        for(Account acc : students) {
            Decimal bal = balanceMap.containsKey(acc.Id) ? balanceMap.get(acc.Id) : 0;
            results.add(new StudentWrapper(acc, bal != null ? bal : 0));
        }
        return results;
    }

    public class ClassSummary {
        @AuraEnabled public String className;
        @AuraEnabled public String section;
        @AuraEnabled public Integer studentCount;

        public ClassSummary(String className, String section, Integer count) {
            this.className = className;
            this.section = section;
            this.studentCount = count;
        }
    }

    @AuraEnabled
    public static List<ClassSummary> getClassSummaryData(String academicYearId) {
        if (String.isBlank(academicYearId)) return new List<ClassSummary>();

        Set<Id> studentIds = new Set<Id>();
        for (Opportunity opp : [
            SELECT AccountId
            FROM Opportunity
            WHERE Academic_Year__c = :academicYearId
            AND IsClosed = false
            AND Account.Type = 'Student'
        ]) {
            if (opp.AccountId != null) studentIds.add(opp.AccountId);
        }

        if (studentIds.isEmpty()) return new List<ClassSummary>();

        Map<String, Integer> countMap = new Map<String, Integer>();
        for (Account acc : [
            SELECT Class__c, Section__c
            FROM Account
            WHERE Id IN :studentIds
            AND Class__c != null
        ]) {
            String section = String.isNotBlank(acc.Section__c) ? acc.Section__c : '';
            String key = acc.Class__c + ':' + section;
            Integer cnt = countMap.containsKey(key) ? countMap.get(key) : 0;
            countMap.put(key, cnt + 1);
        }

        List<ClassSummary> summaries = new List<ClassSummary>();
        List<String> sortedKeys = new List<String>(countMap.keySet());
        sortedKeys.sort();

        for (String key : sortedKeys) {
            String className = key.substringBefore(':');
            String section = key.substringAfter(':');
            summaries.add(new ClassSummary(className, section, countMap.get(key)));
        }

        return summaries;
    }

    private static String getNextClass(String currentClass) {
        List<String> CLASS_ORDER = new List<String>{
            'Nursery', 'LKG', 'UKG',
            'Class-1', 'Class-2', 'Class-3', 'Class-4', 'Class-5',
            'Class-6', 'Class-7', 'Class-8', 'Class-9', 'Class-10'
        };
        if (String.isBlank(currentClass)) return '';
        String normalized = currentClass.replace(' ', '-');
        Integer idx = CLASS_ORDER.indexOf(normalized);
        if (idx >= 0 && idx < CLASS_ORDER.size() - 1) {
            return CLASS_ORDER[idx + 1];
        }
        return '';
    }

    @AuraEnabled
    public static void promoteClasses(String sourceYearId, String targetYearId, List<Map<String, String>> classSectionPairs, List<Id> selectedPricebookEntryIds) {
        if (classSectionPairs == null || classSectionPairs.isEmpty()) return;

        Set<Id> studentIds = new Set<Id>();
        for (Map<String, String> pair : classSectionPairs) {
            String className = pair.get('className');
            String sectionMatch = pair.get('section');
            if (String.isBlank(sectionMatch)) sectionMatch = null;

            for (Opportunity opp : [
                SELECT AccountId
                FROM Opportunity
                WHERE Academic_Year__c = :sourceYearId
                AND Account.Class__c = :className
                AND Account.Section__c = :sectionMatch
                AND Account.Type = 'Student'
                AND IsClosed = false
            ]) {
                studentIds.add(opp.AccountId);
            }
            
            // Because Section__c might be genuinely empty string instead of null in some orgs
            if (String.isBlank(sectionMatch)) {
                for (Opportunity opp : [
                    SELECT AccountId
                    FROM Opportunity
                    WHERE Academic_Year__c = :sourceYearId
                    AND Account.Class__c = :className
                    AND Account.Section__c = ''
                    AND Account.Type = 'Student'
                    AND IsClosed = false
                ]) {
                    studentIds.add(opp.AccountId);
                }
            }
        }  

        if (!studentIds.isEmpty()) {
            promoteStudents(new List<Id>(studentIds), sourceYearId, targetYearId, 'ALL', null, selectedPricebookEntryIds);
        }
    }

    @AuraEnabled
public static void promoteStudents(
    List<Id> studentIds,
    String sourceAcademicYear,
    String targetAcademicYear,
    String targetClassName,
    String targetSectionName,
    List<Id> selectedPricebookEntryIds
) {
    Savepoint sp = Database.setSavepoint();

    try {
        // 1. Resolve Academic Year Name
        String yrName = targetAcademicYear;
        List<Academic_Year__c> ay = [
            SELECT Name FROM Academic_Year__c WHERE Id = :targetAcademicYear LIMIT 1
        ];
        if (!ay.isEmpty()) yrName = ay[0].Name;

        Boolean isBulkGlobal = (targetClassName == 'ALL');

        // 2. Fetch Students with Lookup fields
        List<Account> studentsRaw = [
            SELECT Id, FirstName, LastName,
                   Class__c, Class__r.Name,
                   Section__c, Section__r.Name
            FROM Account
            WHERE Id IN :studentIds
        ];

        // 3. Prepare Class & Section Maps
        Map<String, Id> classNameToId = new Map<String, Id>();
        for (Class__c cls : [SELECT Id, Name FROM Class__c]) {
            classNameToId.put(cls.Name, cls.Id);
        }

        Map<String, Id> sectionNameToId = new Map<String, Id>();
        for (Section__c sec : [SELECT Id, Name FROM Section__c]) {
            sectionNameToId.put(sec.Name, sec.Id);
        }

        // 4. Update Students (Promotion Logic)
        List<Account> studentsToUpdate = new List<Account>();
        Set<String> distinctTargetClasses = new Set<String>();

        for (Account s : studentsRaw) {

            String currentClassName = (s.Class__r != null) ? s.Class__r.Name : null;

            String targetClassFinal = isBulkGlobal
                ? getNextClass(currentClassName)
                : targetClassName;

            if (String.isBlank(targetClassFinal)) continue;

            Id classId = classNameToId.get(targetClassFinal);
            if (classId == null) continue;

            s.Class__c = classId;

            if (String.isNotBlank(targetSectionName)) {
                Id sectionId = sectionNameToId.get(targetSectionName);
                if (sectionId != null) {
                    s.Section__c = sectionId;
                }
            }

            studentsToUpdate.add(s);
            distinctTargetClasses.add(targetClassFinal);
        }

        if (!studentsToUpdate.isEmpty()) {
            update studentsToUpdate;
        }

        // 5. Close old Opportunities
        List<Opportunity> oldOpps = [
            SELECT Id FROM Opportunity
            WHERE AccountId IN :studentIds
            AND Academic_Year__c = :sourceAcademicYear
            AND IsClosed = false
        ];

        for (Opportunity o : oldOpps) {
            o.StageName = 'Closed Won';
        }

        if (!oldOpps.isEmpty()) update oldOpps;

        // 6. Create new Opportunities
        List<Opportunity> newOpps = new List<Opportunity>();

        for (Account s : studentsToUpdate) {

            String fullName =
                (s.FirstName != null ? s.FirstName + ' ' : '') +
                (s.LastName != null ? s.LastName : '');

            String className = (s.Class__r != null) ? s.Class__r.Name : '';

            String oppName = fullName + ' - Admission ' + yrName + ' (' + className + ')';

            newOpps.add(new Opportunity(
                Name = oppName.left(120),
                AccountId = s.Id,
                StageName = 'Prospecting',
                CloseDate = Date.today().addDays(30),
                Class__c = s.Class__c,
                Section__c = s.Section__c,  
                Academic_Year__c = targetAcademicYear
            ));
        }

        if (!newOpps.isEmpty()) insert newOpps;

    } catch (Exception e) {
        Database.rollback(sp);
        throw new AuraHandledException(
            'Promotion Error: ' + e.getMessage() + ' [Line ' + e.getLineNumber() + ']'
        );
    }
}
    @AuraEnabled(cacheable=true)
public static List<Map<String, String>> getSectionOptions() {
    List<Map<String, String>> options = new List<Map<String, String>>();
    for (Section__c sec : [SELECT Id, Name FROM Section__c ORDER BY Name ASC]) {
        options.add(new Map<String, String>{ 'label' => sec.Name, 'value' => sec.Name });
    }
    return options;
}
    
    @AuraEnabled(cacheable=true)
public static List<Map<String, String>> getClassOptions() {
    List<Map<String, String>> options = new List<Map<String, String>>();
    for (Class__c cls : [SELECT Id, Name FROM Class__c ORDER BY Name ASC]) {
        options.add(new Map<String, String>{ 'label' => cls.Name, 'value' => cls.Name });
    }
    return options;
}
    
    @AuraEnabled
    public static void promoteEntireClass(String sourceAcademicYear, String sourceClass, String sourceSection, String targetAcademicYear) {
        // Find students in source class and section
        List<Account> students = [
            SELECT Id 
            FROM Account 
            WHERE Class__c = :sourceClass 
            AND Section__c = :sourceSection 
            AND Type = 'Student'
            AND Id IN (SELECT AccountId FROM Opportunity WHERE Academic_Year__c = :sourceAcademicYear AND IsClosed = false)
        ];
        
        List<Id> studentIds = new List<Id>();
        for (Account a : students) studentIds.add(a.Id);
        
        if (!studentIds.isEmpty()) {
            promoteStudents(studentIds, sourceAcademicYear, targetAcademicYear, 'ALL', null, null);
        }
    }
}