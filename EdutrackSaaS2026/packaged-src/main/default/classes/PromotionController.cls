// PromotionController v17 - clean rewrite
public with sharing class PromotionController {

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

        // Static SOQL is always safer in namespaced orgs as it resolves local fields automatically.
        List<Account> students;
        if (String.isBlank(className) || className == 'ALL') {
            if (String.isBlank(sectionName)) {
                students = [SELECT Id, Name, FirstName, LastName, Roll_No__c, Class__c, Section__c 
                            FROM Account 
                            WHERE Type = 'Student' AND Id IN :studentIdsWithOpp 
                            ORDER BY Name ASC];
            } else {
                students = [SELECT Id, Name, FirstName, LastName, Roll_No__c, Class__c, Section__c 
                            FROM Account 
                            WHERE Type = 'Student' AND Id IN :studentIdsWithOpp AND Section__c = :sectionName
                            ORDER BY Name ASC];
            }
        } else {
            if (String.isBlank(sectionName)) {
                students = [SELECT Id, Name, FirstName, LastName, Roll_No__c, Class__c, Section__c 
                            FROM Account 
                            WHERE Type = 'Student' AND Id IN :studentIdsWithOpp AND Class__c = :className
                            ORDER BY Name ASC];
            } else {
                students = [SELECT Id, Name, FirstName, LastName, Roll_No__c, Class__c, Section__c 
                            FROM Account 
                            WHERE Type = 'Student' AND Id IN :studentIdsWithOpp AND Class__c = :className AND Section__c = :sectionName
                            ORDER BY Name ASC];
            }
        }
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
    public static void promoteStudents(List<Id> studentIds, String sourceAcademicYear, String targetAcademicYear, String targetClassName, String targetSectionName, List<Id> selectedPricebookEntryIds) {
        Savepoint sp = Database.setSavepoint();
        try {
            // 1. Resolve target year name
            String yrName = targetAcademicYear;
            List<Academic_Year__c> ay = [SELECT Name FROM Academic_Year__c WHERE Id = :targetAcademicYear LIMIT 1];
            if (!ay.isEmpty()) yrName = ay[0].Name;

            Boolean isBulkGlobal = (targetClassName == 'ALL');

            // 2. Calculate pending balances from source year
            Map<Id, Decimal> balMap = new Map<Id, Decimal>();
            if (String.isNotBlank(sourceAcademicYear)) {
                for (AggregateResult ar : [
                    SELECT Opportunity.AccountId accId, SUM(TotalPrice) total
                    FROM OpportunityLineItem
                    WHERE Opportunity.AccountId IN :studentIds
                    AND Opportunity.Academic_Year__c = :sourceAcademicYear
                    GROUP BY Opportunity.AccountId
                ]) {
                    Decimal t = (Decimal)ar.get('total');
                    balMap.put((Id)ar.get('accId'), t != null ? t : 0);
                }
                for (AggregateResult ar : [
                    SELECT Invoice__r.Student__c sid, SUM(Amount__c) total
                    FROM Invoice_Item__c
                    WHERE Invoice__r.Student__c IN :studentIds
                    AND Invoice__r.Opportunity__r.Academic_Year__c = :sourceAcademicYear
                    AND Invoice__r.Status__c = 'Paid'
                    GROUP BY Invoice__r.Student__c
                ]) {
                    Id sid = (Id)ar.get('sid');
                    Decimal paid = (Decimal)ar.get('total');
                    Decimal current = (balMap.containsKey(sid) && balMap.get(sid) != null) ? balMap.get(sid) : 0;
                    balMap.put(sid, current - (paid != null ? paid : 0));
                }
            }

            // 3. Close old opportunities
            List<Opportunity> oldOpps = [SELECT Id FROM Opportunity WHERE AccountId IN :studentIds AND Academic_Year__c = :sourceAcademicYear AND IsClosed = false];
            for (Opportunity o : oldOpps) { o.StageName = 'Closed Won'; }
            if (!oldOpps.isEmpty()) update oldOpps;

            // 4. Move students to next class
            List<Account> studentsToUpdate = new List<Account>();
            Set<String> distinctTargetClasses = new Set<String>();
            List<Account> studentsRaw = [SELECT Id, FirstName, LastName, Class__c, Section__c FROM Account WHERE Id IN :studentIds];
            
            for (Account s : studentsRaw) {
                String targetClass = isBulkGlobal ? getNextClass(s.Class__c) : targetClassName;
                if (String.isBlank(targetClass)) continue;
                
                s.Class__c = targetClass;
                s.Section__c = String.isNotBlank(targetSectionName) ? targetSectionName : s.Section__c;
                studentsToUpdate.add(s);
                distinctTargetClasses.add(targetClass);
            }
            if (!studentsToUpdate.isEmpty()) update studentsToUpdate;

            // 5. Resolve Pricebooks for target classes
            Map<String, Id> classToPbId = new Map<String, Id>();
            Map<Id, List<PricebookEntry>> pbIdToPBEs = new Map<Id, List<PricebookEntry>>();
            Map<Id, Id> pbIdToDuesPBEId = new Map<Id, Id>();

            if (isBulkGlobal) {
                List<String> targetClassNames = new List<String>();
                List<String> pbLikes = new List<String>();
                for (String tc : distinctTargetClasses) {
                    String cleanTc = tc.replace('-', ' ');
                    targetClassNames.add(cleanTc);
                    pbLikes.add(cleanTc + ' - %');
                }
                
                List<Pricebook2> pbs = [SELECT Id, Name FROM Pricebook2 WHERE (Name IN :targetClassNames OR Name LIKE :pbLikes) AND IsActive = true ORDER BY Academic_Year__c DESC NULLS LAST];
                for (String tc : distinctTargetClasses) {
                    String cleanTc = tc.replace('-', ' ');
                    for (Pricebook2 pb : pbs) {
                        if (pb.Name == cleanTc || pb.Name.startsWith(cleanTc + ' - ')) {
                            classToPbId.put(tc, pb.Id);
                            break;
                        }
                    }
                }
                
                List<Id> pbIds = classToPbId.values();
                List<PricebookEntry> allPbes = [SELECT Id, UnitPrice, Pricebook2Id, Product2.Name, Product2.ProductCode FROM PricebookEntry WHERE Pricebook2Id IN :pbIds AND IsActive = true];
                
                for (PricebookEntry pbe : allPbes) {
                    if (!pbIdToPBEs.containsKey(pbe.Pricebook2Id)) pbIdToPBEs.put(pbe.Pricebook2Id, new List<PricebookEntry>());
                    pbIdToPBEs.get(pbe.Pricebook2Id).add(pbe);
                    
                    if (pbe.Product2.Name.containsIgnoreCase('Previous') || pbe.Product2.ProductCode == 'PREV_DUES') {
                        pbIdToDuesPBEId.put(pbe.Pricebook2Id, pbe.Id);
                    }
                }
            } else {
                Id singlePbId = null;
                if (selectedPricebookEntryIds != null && !selectedPricebookEntryIds.isEmpty()) {
                    List<PricebookEntry> pbeList = [SELECT Pricebook2Id FROM PricebookEntry WHERE Id = :selectedPricebookEntryIds[0] LIMIT 1];
                    if (!pbeList.isEmpty()) singlePbId = pbeList[0].Pricebook2Id;
                } else if (!studentsToUpdate.isEmpty()) {
                    String cleanTc = studentsToUpdate[0].Class__c.replace('-', ' ');
                    String pbLike = cleanTc + ' - %';
                    List<Pricebook2> pbs = [SELECT Id FROM Pricebook2 WHERE (Name = :cleanTc OR Name LIKE :pbLike) AND IsActive = true ORDER BY Academic_Year__c DESC NULLS LAST LIMIT 1];
                    if (!pbs.isEmpty()) singlePbId = pbs[0].Id;
                }
                
                if (singlePbId != null) {
                    classToPbId.put(targetClassName, singlePbId);
                    
                    List<PricebookEntry> selectedPbes = (selectedPricebookEntryIds != null && !selectedPricebookEntryIds.isEmpty())
                        ? [SELECT Id, UnitPrice, Pricebook2Id, Product2.Name, Product2.ProductCode FROM PricebookEntry WHERE Id IN :selectedPricebookEntryIds]
                        : [SELECT Id, UnitPrice, Pricebook2Id, Product2.Name, Product2.ProductCode FROM PricebookEntry WHERE Pricebook2Id = :singlePbId AND IsActive = true AND Product2.ProductCode != 'PREV_DUES' AND (NOT Product2.Name LIKE '%Previous%')];
                        
                    pbIdToPBEs.put(singlePbId, selectedPbes);
                    
                    List<PricebookEntry> dues = [SELECT Id FROM PricebookEntry WHERE Pricebook2Id = :singlePbId AND (Product2.Name LIKE '%Previous%' OR Product2.ProductCode = 'PREV_DUES') AND IsActive = true LIMIT 1];
                    if (!dues.isEmpty()) {
                        pbIdToDuesPBEId.put(singlePbId, dues[0].Id);
                    }
                }
            }

            // 6. Create new Opportunities
            List<Opportunity> newOpps = new List<Opportunity>();
            for (Account s : studentsToUpdate) {
                String fullName = (s.FirstName != null ? s.FirstName + ' ' : '') + (s.LastName != null ? s.LastName : '');
                String n = fullName + ' - Admission ' + yrName + ' (' + s.Class__c + ')';
                Id pbId = classToPbId.get(s.Class__c);
                
                newOpps.add(new Opportunity(
                    Name = n.left(120),
                    AccountId = s.Id,
                    StageName = 'Prospecting',
                    CloseDate = Date.today().addDays(30),
                    Class__c = s.Class__c,
                    Section__c = s.Section__c,
                    Academic_Year__c = targetAcademicYear,
                    Pricebook2Id = pbId
                ));
            }
            if (!newOpps.isEmpty()) insert newOpps;

            // 7. Add fee line items
            List<OpportunityLineItem> olis = new List<OpportunityLineItem>();
            for (Opportunity opp : newOpps) {
                Decimal bal = (balMap.containsKey(opp.AccountId) && balMap.get(opp.AccountId) != null) ? balMap.get(opp.AccountId) : 0;
                if (bal < 0) bal = 0;
                Boolean duesAdded = false;
                
                Id duesPbeId = opp.Pricebook2Id != null ? pbIdToDuesPBEId.get(opp.Pricebook2Id) : null;
                List<PricebookEntry> pbes = opp.Pricebook2Id != null && pbIdToPBEs.containsKey(opp.Pricebook2Id) 
                    ? pbIdToPBEs.get(opp.Pricebook2Id) 
                    : new List<PricebookEntry>();

                for (PricebookEntry pbe : pbes) {
                    Decimal price = pbe.UnitPrice;
                    if (duesPbeId != null && pbe.Id == duesPbeId) {
                        price = bal;
                        duesAdded = true;
                    }
                    if (duesPbeId != null && pbe.Id == duesPbeId && price == 0) {
                        continue;
                    }
                    olis.add(new OpportunityLineItem(
                        OpportunityId = opp.Id,
                        PricebookEntryId = pbe.Id,
                        Quantity = 1,
                        UnitPrice = price
                    ));
                }

                if (bal > 0 && !duesAdded && duesPbeId != null) {
                    olis.add(new OpportunityLineItem(
                        OpportunityId = opp.Id,
                        PricebookEntryId = duesPbeId,
                        Quantity = 1,
                        UnitPrice = bal
                    ));
                }
            }
            if (!olis.isEmpty()) insert olis;

        } catch (Exception e) {
            Database.rollback(sp);
            throw new AuraHandledException('Promotion Error: ' + e.getMessage() + ' [Line ' + e.getLineNumber() + ']');
        }
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