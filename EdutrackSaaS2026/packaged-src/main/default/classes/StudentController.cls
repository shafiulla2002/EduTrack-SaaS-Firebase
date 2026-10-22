public with sharing class StudentController {

    // ─────────────────────────────────────────────────────────
    //  INNER WRAPPER: StudentListItem (for list/search view)
    // ─────────────────────────────────────────────────────────
    public class StudentListItem {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public String phone;
        @AuraEnabled public String className;
        @AuraEnabled public String section;
        @AuraEnabled public String avatar;
    }

    // ─────────────────────────────────────────────────────────
    //  INNER WRAPPER: StudentDetail (for detail view)
    // ─────────────────────────────────────────────────────────
    public class StudentDetail {
        @AuraEnabled public Map<String, Object> student;
        @AuraEnabled public List<Map<String, Object>> products;
        @AuraEnabled public List<Map<String, Object>> invoices;
        @AuraEnabled public List<Map<String, Object>> exams;
        @AuraEnabled public List<AttendanceStat> attendanceStats;
        @AuraEnabled public List<Map<String, Object>> cases;
        @AuraEnabled public Map<Id, String> academicYearNames;
    }

    public class AttendanceStat {
        @AuraEnabled public Id year;
        @AuraEnabled public Integer workingDays;
        @AuraEnabled public List<AttendanceCount> attendance;
    }

    public class AttendanceCount {
        @AuraEnabled public String status;
        @AuraEnabled public Integer cnt;
    }

    // ─────────────────────────────────────────────────────────
    //  1. SEARCH STUDENTS (for list view)
    // ─────────────────────────────────────────────────────────
    @AuraEnabled(cacheable=false)
    public static List<StudentListItem> searchStudents(String searchTerm, String academicYear, String className, String sectionName) {
        String query = 'SELECT Id, Name, FirstName, LastName, PersonMobilePhone, Class__c, Section__c, Roll_No__c ';
        query += 'FROM Account ';
        query += 'WHERE Type = \'Student\' ';

        if (String.isNotBlank(searchTerm)) {
            String likeTerm = '%' + searchTerm + '%';
            query += 'AND (Name LIKE :likeTerm OR PersonMobilePhone LIKE :likeTerm OR Roll_No__c LIKE :likeTerm) ';
        }
        if (String.isNotBlank(academicYear)) {
            // Filter by students who have an opportunity in that academic year
            Set<Id> filteredIds = new Set<Id>();
            for (Opportunity opp : [SELECT AccountId FROM Opportunity WHERE Academic_Year__c = :academicYear]) {
                filteredIds.add(opp.AccountId);
            }
            if (!filteredIds.isEmpty()) {
                query += 'AND Id IN :filteredIds ';
            } else {
                return new List<StudentListItem>(); // No matches
            }
        }
        if (String.isNotBlank(className)) {
            query += 'AND Class__c = :className ';
        }
        if (String.isNotBlank(sectionName)) {
            query += 'AND Section__c = :sectionName ';
        }
        query += 'ORDER BY Name ASC LIMIT 200';

        List<Account> accounts = Database.query(query);
        List<StudentListItem> results = new List<StudentListItem>();

        for (Account acc : accounts) {
            StudentListItem item = new StudentListItem();
            item.id = acc.Id;
            item.name = acc.Name;
            item.phone = acc.PersonMobilePhone;
            item.className = acc.Class__c;
            item.section = acc.Section__c;
            // Build initials avatar
            String firstName = acc.FirstName != null ? acc.FirstName : '';
            String lastName = acc.LastName != null ? acc.LastName : '';
            item.avatar = (firstName.length() > 0 ? firstName.substring(0, 1) : '') +
                          (lastName.length() > 0 ? lastName.substring(0, 1) : '');
            results.add(item);
        }
        return results;
    }

    // ─────────────────────────────────────────────────────────
    //  2. GET STUDENT DETAILS (for detail view)
    // ─────────────────────────────────────────────────────────
    @AuraEnabled(cacheable=false)
    public static StudentDetail getStudentDetails(Id studentId) {
        StudentDetail detail = new StudentDetail();

        // 1. Student (Account) record
        Account rawStudent = [
            SELECT Id, Name, FirstName, LastName, PersonMobilePhone, PersonEmail,
                   PersonBirthdate, Class__c, Section__c, Roll_No__c,
                   Father_Name__c, Mother_Name__c, Emergency_Contact__c,
                   PersonMailingStreet, PersonMailingCity, PersonMailingPostalCode,
                   State__c, Country__c, Village__c, Active__c
            FROM Account
            WHERE Id = :studentId
            LIMIT 1
        ];
        detail.student = NamespaceUtils.stripNamespace(rawStudent);

        // 2. Fee Products (OpportunityLineItems across all open Opportunities)
        List<OpportunityLineItem> rawProducts = [
            SELECT Id, Product2Id, Product2.Name, Product2.ProductCode, Product2.Description,
                   UnitPrice, Quantity, TotalPrice, Discount,
                   Opportunity.Id, Opportunity.Name, Opportunity.Academic_Year__c, Opportunity.IsClosed
            FROM OpportunityLineItem
            WHERE Opportunity.AccountId = :studentId
            ORDER BY Opportunity.Academic_Year__c DESC NULLS LAST, Product2.Name ASC
        ];
        detail.products = NamespaceUtils.stripNamespaceList(rawProducts);

        // Map Academic Year IDs to their Names securely (avoids standard object custom relationship namespace errors)
        Set<Id> yearIds = new Set<Id>();
        for (OpportunityLineItem oli : rawProducts) {
            if (oli.Opportunity.Academic_Year__c != null) {
                yearIds.add(oli.Opportunity.Academic_Year__c);
            }
        }
        Map<Id, String> yearMap = new Map<Id, String>();
        for (Academic_Year__c ay : [SELECT Id, Name FROM Academic_Year__c WHERE Id IN :yearIds]) {
            yearMap.put(ay.Id, ay.Name);
        }
        detail.academicYearNames = yearMap;

        // 3. Invoices
        List<Invoice__c> rawInvoices = [
            SELECT Id, Name, Invoice_Date__c, Status__c, Payment_Method__c,
                   (SELECT Id, Amount__c, Product__r.Name FROM Invoice_Items__r ORDER BY CreatedDate ASC)
            FROM Invoice__c
            WHERE Student__c = :studentId
            AND Status__c != 'Cancelled'
            ORDER BY CreatedDate DESC
        ];
        detail.invoices = NamespaceUtils.stripNamespaceList(rawInvoices);

        // 4. Exams (Exam__c records linked to student) — dynamic query to handle optional subject fields
        try {
            // Get all field API names from Exam__c dynamically
            Set<String> examFields = Schema.SObjectType.Exam__c.fields.getMap().keySet();
            String examFieldList = 'Id, Name, Exam_Type__c';
            Set<String> existingFields = new Set<String>{'id', 'name', 'exam_type__c'};
            
            for (String f : examFields) {
                String lowerF = f.toLowerCase();
                if (!existingFields.contains(lowerF) && !new Set<String>{'isdeleted', 'createddate', 'createdbyid', 'lastmodifieddate', 'lastmodifiedbyid', 'systemmodstamp'}.contains(lowerF)) {
                    examFieldList += ', ' + f;
                    existingFields.add(lowerF);
                }
            }
            String q = 'SELECT ' + examFieldList + ' FROM Exam__c WHERE Student__c = :studentId ORDER BY CreatedDate DESC';
            System.debug('>>> StudentController Exam Query: ' + q);
            detail.exams = NamespaceUtils.stripNamespaceList(Database.query(q));
        } catch (Exception e) {
            System.debug('>>> StudentController Exam Error: ' + e.getMessage());
            detail.exams = new List<Map<String, Object>>();
        }

        // 5. Attendance Stats grouped by Academic Year
        detail.attendanceStats = getAttendanceStats(studentId);

        // 6. Cases / Behaviour
        List<Case> rawCases = [
            SELECT Id, Subject, Type, Status, Priority, Description, CreatedDate
            FROM Case
            WHERE AccountId = :studentId
            ORDER BY CreatedDate DESC
            LIMIT 20
        ];
        detail.cases = NamespaceUtils.stripNamespaceList(rawCases);

        return detail;
    }

    private static List<AttendanceStat> getAttendanceStats(Id studentId) {
        List<AttendanceStat> statsList = new List<AttendanceStat>();

        // 1. Get Academic Years
        List<Academic_Year__c> years = [
            SELECT Id, Name, Start_Date__c, End_Date__c 
            FROM Academic_Year__c 
            WHERE Is_Active__c = true 
            ORDER BY Start_Date__c DESC
        ];
        if (years.isEmpty()) return statsList;

        // 2. Get student's join date
        Account acc = [SELECT Id, CreatedDate FROM Account WHERE Id = :studentId LIMIT 1];
        Date joinDate = acc.CreatedDate.date();

        // 3. Query all Attendance Sessions
        List<Attendance_Session__c> allSessions = [
            SELECT Id, Date__c 
            FROM Attendance_Session__c 
            WHERE Date__c >= :joinDate
            ORDER BY Date__c DESC
        ];

        // 4. Query student's absences
        List<Attendance__c> absences = [
            SELECT Id, Attendance_Status__c, Attendance_Session__r.Date__c
            FROM Attendance__c
            WHERE Student__c = :studentId
            AND Attendance_Status__c = 'Absent'
        ];

        // 5. Map sessions and absences to years
        for (Academic_Year__c ay : years) {
            Integer workingDays = 0;
            Integer absentCount = 0;

            for (Attendance_Session__c sess : allSessions) {
                if (sess.Date__c >= ay.Start_Date__c && sess.Date__c <= ay.End_Date__c) {
                    workingDays++;
                }
            }

            for (Attendance__c att : absences) {
                Date attDate = att.Attendance_Session__r.Date__c;
                if (attDate >= ay.Start_Date__c && attDate <= ay.End_Date__c) {
                    absentCount++;
                }
            }

            // Only add if there's data for this year or it's the current active search year
            if (workingDays > 0 || years.size() == 1) {
                AttendanceStat stat = new AttendanceStat();
                stat.year = ay.Id;
                stat.workingDays = workingDays;
                stat.attendance = new List<AttendanceCount>();
                
                if (absentCount > 0) {
                    AttendanceCount ac = new AttendanceCount();
                    ac.status = 'Absent';
                    ac.cnt = absentCount;
                    stat.attendance.add(ac);
                }
                statsList.add(stat);
            }
        }

        return statsList;
    }

    // ─────────────────────────────────────────────────────────
    //  3. GET ACADEMIC YEAR OPTIONS
    // ─────────────────────────────────────────────────────────
    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getAcademicYearOptions() {
        List<Map<String, String>> options = new List<Map<String, String>>();
        try {
            for (Academic_Year__c ay : [
                SELECT Id, Name
                FROM Academic_Year__c
                WHERE Is_Active__c = true
                ORDER BY Start_Date__c DESC
            ]) {
                options.add(new Map<String, String>{
                    'label' => ay.Name,
                    'value' => ay.Id
                });
            }
        } catch (Exception e) {
            System.debug('Error fetching academic years: ' + e.getMessage());
        }
        return options;
    }

    // ─────────────────────────────────────────────────────────
    //  4. APPLY DISCOUNT (bulk, per academic year opportunity)
    // ─────────────────────────────────────────────────────────
    @AuraEnabled
    public static void applyDiscount(Id studentId, Id academicYearId, Decimal discountPercent) {
        try {
            // Find the open opportunity for this student + year
            List<Opportunity> opps = [
                SELECT Id
                FROM Opportunity
                WHERE AccountId = :studentId
                AND Academic_Year__c = :academicYearId
                AND IsClosed = false
                LIMIT 1
            ];
            if (opps.isEmpty()) {
                throw new AuraHandledException('No open opportunity found for this student and academic year.');
            }
            Id oppId = opps[0].Id;

            // Get all line items for that opportunity (excluding Previous Dues)
            List<OpportunityLineItem> olis = [
                SELECT Id, Discount, Product2.ProductCode, Product2.Name
                FROM OpportunityLineItem
                WHERE OpportunityId = :oppId
                AND (Product2.ProductCode != 'PREV_DUES' OR Product2.ProductCode = null)
            ];

            for (OpportunityLineItem oli : olis) {
                // Don't apply to "Previous" dues products
                if (oli.Product2?.ProductCode == 'PREV_DUES' || (oli.Product2?.Name != null && oli.Product2.Name.contains('Previous'))) {
                    continue;
                }
                oli.Discount = discountPercent;
            }
            if (!olis.isEmpty()) {
                update olis;
            }
        } catch (AuraHandledException ane) {
            throw ane;
        } catch (Exception e) {
            throw new AuraHandledException('Error applying discount: ' + e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────
    //  5. LEGACY: getCandidatesByBatch (kept for PromotionController use)
    // ─────────────────────────────────────────────────────────
    @AuraEnabled(cacheable=false)
    public static List<Map<String, Object>> getCandidatesByBatch(String year, String className, String section) {
        String query = 'SELECT Id, Name, Roll_No__c, Class__c, Section__c ' +
                       'FROM Account ' +
                       'WHERE Type = \'Student\' ' +
                       'AND Class__c = :className ';

        if (String.isNotBlank(section)) {
            query += 'AND Section__c = :section ';
        }

        query += 'ORDER BY Name ASC';

        return NamespaceUtils.stripNamespaceList(Database.query(query));
    }
}