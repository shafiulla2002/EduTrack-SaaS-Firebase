public without sharing class ClassManagementController {

    public class TeacherResponse {
        @AuraEnabled public Boolean success;
        @AuraEnabled public String teacherId;
        @AuraEnabled public String teacherName;
        @AuraEnabled public Integer skillsCount;
        @AuraEnabled public String error;
        @AuraEnabled public String stackTrace;
    }

    /* ═══════════════════════════════════════════════════════════════
       GET ACADEMIC YEARS
       ═══════════════════════════════════════════════════════════════ */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getAcademicYears() {
        return NamespaceUtils.stripNamespaceList([
            SELECT Id, Name, Start_Date__c, End_Date__c
            FROM Academic_Year__c
            WHERE Is_Active__c = true
            ORDER BY Start_Date__c DESC
        ]);
    }

    /* ═══════════════════════════════════════════════════════════════
       GET ALL CLASSES
       ═══════════════════════════════════════════════════════════════ */
    @AuraEnabled
    public static List<Map<String, Object>> getAllClasses() {
        return NamespaceUtils.stripNamespaceList([
            SELECT Id, Name
            FROM Class__c
            WHERE Is_Active__c = true
            ORDER BY Name
        ]);
    }

    /* ═══════════════════════════════════════════════════════════════
       GET ALL SECTIONS
       ═══════════════════════════════════════════════════════════════ */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getAllSections() {
        return NamespaceUtils.stripNamespaceList([
            SELECT Id, Name
            FROM Section__c
            WHERE Is_Active__c = true
            ORDER BY Name
        ]);
    }

    /* ═══════════════════════════════════════════════════════════════
       GET CLASSES  (used by class management modal)
       ═══════════════════════════════════════════════════════════════ */
    @AuraEnabled(cacheable=false)
    public static List<Map<String, Object>> getClasses() {
        List<Map<String, Object>> result = new List<Map<String, Object>>();
        for (Class__c c : [
            SELECT Id, Name, Is_Active__c
            FROM Class__c
            ORDER BY Name
        ]) {
            result.add(new Map<String, Object>{
                'id'       => c.Id,
                'name'     => c.Name,
                'isActive' => c.Is_Active__c
            });
        }
        return result;
    }

    /* ═══════════════════════════════════════════════════════════════
       CREATE CLASS
       ═══════════════════════════════════════════════════════════════ */
    @AuraEnabled
    public static Map<String, Object> createClass(String className) {
        if (String.isBlank(className)) {
            throw new AuraHandledException('Class Name is required.');
        }
        // duplicate check
        List<Class__c> existing = [
            SELECT Id FROM Class__c WHERE Name = :className LIMIT 1
        ];
        if (!existing.isEmpty()) {
            throw new AuraHandledException('A class named "' + className + '" already exists.');
        }
        Class__c c = new Class__c(
            Name         = className,
            Is_Active__c = true
        );
        insert c;
        return new Map<String, Object>{
            'id'   => c.Id,
            'name' => c.Name
        };
    }

    /* ═══════════════════════════════════════════════════════════════
       DELETE CLASS
       ═══════════════════════════════════════════════════════════════ */
    @AuraEnabled
    public static void deleteClass(String classId) {
        if (String.isBlank(classId)) {
            throw new AuraHandledException('Class ID is required.');
        }
        // Check if any Class_Section__c references this class
        List<Class_Section__c> linked = [
            SELECT Id FROM Class_Section__c WHERE Class__c = :classId LIMIT 1
        ];
        if (!linked.isEmpty()) {
            throw new AuraHandledException(
                'Cannot delete this class because it is linked to one or more class sections.'
            );
        }
        delete [SELECT Id FROM Class__c WHERE Id = :classId LIMIT 1];
    }

    /* ═══════════════════════════════════════════════════════════════
       GET SECTIONS  (used by section management modal)
       ═══════════════════════════════════════════════════════════════ */
    @AuraEnabled(cacheable=false)
    public static List<Map<String, Object>> getSections() {
        List<Map<String, Object>> result = new List<Map<String, Object>>();
        for (Section__c s : [
            SELECT Id, Name, Is_Active__c
            FROM Section__c
            ORDER BY Name
        ]) {
            result.add(new Map<String, Object>{
                'id'       => s.Id,
                'name'     => s.Name,
                'isActive' => s.Is_Active__c
            });
        }
        return result;
    }

    /* ═══════════════════════════════════════════════════════════════
       CREATE SECTION
       ═══════════════════════════════════════════════════════════════ */
    @AuraEnabled
    public static Map<String, Object> createSection(String sectionName) {
        if (String.isBlank(sectionName)) {
            throw new AuraHandledException('Section Name is required.');
        }
        // duplicate check
        List<Section__c> existing = [
            SELECT Id FROM Section__c WHERE Name = :sectionName LIMIT 1
        ];
        if (!existing.isEmpty()) {
            throw new AuraHandledException('A section named "' + sectionName + '" already exists.');
        }
        Section__c s = new Section__c(
            Name         = sectionName,
            Is_Active__c = true
        );
        insert s;
        return new Map<String, Object>{
            'id'   => s.Id,
            'name' => s.Name
        };
    }

    /* ═══════════════════════════════════════════════════════════════
       DELETE SECTION
       ═══════════════════════════════════════════════════════════════ */
    @AuraEnabled
    public static void deleteSection(String sectionId) {
        if (String.isBlank(sectionId)) {
            throw new AuraHandledException('Section ID is required.');
        }
        // Check if any Class_Section__c references this section
        List<Class_Section__c> linked = [
            SELECT Id FROM Class_Section__c WHERE Section__c = :sectionId LIMIT 1
        ];
        if (!linked.isEmpty()) {
            throw new AuraHandledException(
                'Cannot delete this section because it is linked to one or more class sections.'
            );
        }
        delete [SELECT Id FROM Section__c WHERE Id = :sectionId LIMIT 1];
    }

    /* ═══════════════════════════════════════════════════════════════
       GET ALL ACTIVE SUBJECTS
       ═══════════════════════════════════════════════════════════════ */
    @AuraEnabled
    public static List<Map<String, Object>> getAllSubjects() {
        return NamespaceUtils.stripNamespaceList([
            SELECT Id, Name
            FROM Subject__c
            WHERE Is_Active__c = true
            ORDER BY Name
        ]);
    }

    /* ═══════════════════════════════════════════════════════════════
       CREATE SINGLE SUBJECT
       ═══════════════════════════════════════════════════════════════ */
    @AuraEnabled
    public static Map<String, Object> createSubject(
        String subjectName,
        String subjectCode,
        String description
    ) {
        if (String.isBlank(subjectName)) {
            throw new AuraHandledException('Subject Name is required.');
        }
        List<Subject__c> existing = [
            SELECT Id FROM Subject__c WHERE Name = :subjectName LIMIT 1
        ];
        if (!existing.isEmpty()) {
            throw new AuraHandledException('A subject with the name "' + subjectName + '" already exists.');
        }
        Subject__c s = new Subject__c(
            Name         = subjectName,
            Is_Active__c = true
        );
        insert s;
        return new Map<String, Object>{
            'id'   => s.Id,
            'name' => s.Name
        };
    }

    /* ═══════════════════════════════════════════════════════════════
       BULK CREATE SUBJECTS (from CSV/Excel import)
       ═══════════════════════════════════════════════════════════════ */
    @AuraEnabled
    public static Map<String, Object> bulkCreateSubjects(
        List<Map<String, Object>> subjectsData
    ) {
        if (subjectsData == null || subjectsData.isEmpty()) {
            throw new AuraHandledException('No subject data provided.');
        }

        Set<String> incomingNames = new Set<String>();
        for (Map<String, Object> row : subjectsData) {
            String n = (String) row.get('name');
            if (String.isNotBlank(n)) incomingNames.add(n.trim().toLowerCase());
        }

        Set<String> existingNames = new Set<String>();
        for (Subject__c s : [SELECT Name FROM Subject__c WHERE Is_Active__c = true]) {
            existingNames.add(s.Name.toLowerCase());
        }

        List<Subject__c> toInsert  = new List<Subject__c>();
        List<String>     skipped   = new List<String>();
        List<String>     errorRows = new List<String>();
        Integer rowNum = 1;

        for (Map<String, Object> row : subjectsData) {
            String name = row.get('name') != null ? ((String) row.get('name')).trim() : '';
            if (String.isBlank(name)) {
                errorRows.add('Row ' + rowNum + ': Subject name is required.');
                rowNum++;
                continue;
            }
            if (existingNames.contains(name.toLowerCase())) {
                skipped.add(name);
                rowNum++;
                continue;
            }
            Subject__c s = new Subject__c(Name = name, Is_Active__c = true);
            toInsert.add(s);
            existingNames.add(name.toLowerCase());
            rowNum++;
        }

        Integer created = 0;
        if (!toInsert.isEmpty()) {
            Database.SaveResult[] results = Database.insert(toInsert, false);
            for (Integer i = 0; i < results.size(); i++) {
                if (results[i].isSuccess()) {
                    created++;
                } else {
                    errorRows.add(toInsert[i].Name + ': ' + results[i].getErrors()[0].getMessage());
                }
            }
        }

        return new Map<String, Object>{
            'created'      => created,
            'skipped'      => skipped.size(),
            'errors'       => errorRows.size(),
            'errorDetails' => errorRows,
            'skippedNames' => skipped
        };
    }

    /* ═══════════════════════════════════════════════════════════════
       BULK CREATE TEACHERS (from CSV/Excel import)
       ═══════════════════════════════════════════════════════════════ */

   @AuraEnabled
public static Map<String, Object> bulkCreateTeachers(
    List<Map<String, Object>> teachersData
) {
    if (teachersData == null || teachersData.isEmpty())
        throw new AuraHandledException('No teacher data provided.');
 
    Set<String> incomingEmails = new Set<String>();
    for (Map<String, Object> row : teachersData) {
        String e = (String) row.get('email');
        if (String.isNotBlank(e)) incomingEmails.add(e.trim().toLowerCase());
    }
 
    Set<String> existingEmails = new Set<String>();
    for (Account a : [
        SELECT PersonEmail FROM Account
        WHERE PersonEmail IN :incomingEmails AND IsPersonAccount = true
    ]) {
        if (String.isNotBlank(a.PersonEmail)) existingEmails.add(a.PersonEmail.toLowerCase());
    }
 
    Id personRtId;
    try {
        personRtId = [
            SELECT Id FROM RecordType
            WHERE SObjectType = 'Account' AND IsPersonType = true LIMIT 1
        ].Id;
    } catch (Exception ex) {
        throw new AuraHandledException('Person Account record type not found.');
    }
 
    Map<String, Id> subjectNameToId = new Map<String, Id>();
    for (Subject__c s : [SELECT Id, Name FROM Subject__c WHERE Is_Active__c = true]) {
        subjectNameToId.put(s.Name.toLowerCase().trim(), s.Id);
    }
 
    List<Account>                  toInsert    = new List<Account>();
    List<List<Map<String,String>>> skillMatrix = new List<List<Map<String,String>>>();
    List<String>                   skipped     = new List<String>();
    List<String>                   errorRows   = new List<String>();
    Integer rowNum = 1;
 
    for (Map<String, Object> row : teachersData) {
        String firstName     = row.get('firstName')        != null ? ((String)row.get('firstName')).trim()        : '';
        String lastName      = row.get('lastName')         != null ? ((String)row.get('lastName')).trim()         : '';
        String email         = row.get('email')            != null ? ((String)row.get('email')).trim()            : '';
        String phone         = row.get('phone')            != null ? ((String)row.get('phone')).trim()            : '';
        String qual          = row.get('qualification')    != null ? ((String)row.get('qualification')).trim()    : '';
        String gender        = row.get('gender')           != null ? ((String)row.get('gender')).trim()           : '';
        String dob           = row.get('dateOfBirth')      != null ? ((String)row.get('dateOfBirth')).trim()      : '';
        String joinDate      = row.get('joiningDate')      != null ? ((String)row.get('joiningDate')).trim()      : '';
        String address       = row.get('address')          != null ? ((String)row.get('address')).trim()          : '';
        String teachingType  = row.get('teachingType')     != null ? ((String)row.get('teachingType')).trim()     : '';
        String employeeId    = row.get('employeeId')       != null ? ((String)row.get('employeeId')).trim()       : '';
        String designation   = row.get('designation')      != null ? ((String)row.get('designation')).trim()      : '';
        String subjectTaught = row.get('subjectTaught')    != null ? ((String)row.get('subjectTaught')).trim()    : '';
        String staffStatus   = row.get('staffStatus')      != null ? ((String)row.get('staffStatus')).trim()      : '';
        String basicStr      = row.get('basicSalary')      != null ? ((String)row.get('basicSalary')).trim()      : '';
        String allowStr      = row.get('allowances')       != null ? ((String)row.get('allowances')).trim()       : '';
        String deductStr     = row.get('deductions')       != null ? ((String)row.get('deductions')).trim()       : '';
        String daStr         = row.get('da')               != null ? ((String)row.get('da')).trim()               : '';
        String hraStr        = row.get('hra')              != null ? ((String)row.get('hra')).trim()              : '';
        String pfStr         = row.get('pfDeduction')      != null ? ((String)row.get('pfDeduction')).trim()      : '';
        String bankAccStr    = row.get('bankAccountNumber')!= null ? ((String)row.get('bankAccountNumber')).trim(): '';
        String ifscStr       = row.get('ifscCode')         != null ? ((String)row.get('ifscCode')).trim()         : '';
 
        if (String.isBlank(firstName) || String.isBlank(lastName)) {
            errorRows.add('Row ' + rowNum + ': First Name and Last Name are required.');
            rowNum++; continue;
        }
        if (String.isBlank(email)) {
            errorRows.add('Row ' + rowNum + ' (' + firstName + ' ' + lastName + '): Email is required.');
            rowNum++; continue;
        }
        if (existingEmails.contains(email.toLowerCase())) {
            skipped.add(firstName + ' ' + lastName + ' (' + email + ')');
            rowNum++; continue;
        }
 
        List<Map<String,String>> rowSkills = new List<Map<String,String>>();
        for (Integer i = 1; i <= 5; i++) {
            String subjectName = row.get('subject'    + i) != null ? ((String)row.get('subject'    + i)).trim() : '';
            String skillLevel  = row.get('skillLevel' + i) != null ? ((String)row.get('skillLevel' + i)).trim() : '';
            if (String.isNotBlank(subjectName) && String.isNotBlank(skillLevel)) {
                rowSkills.add(new Map<String,String>{ 'subjectName' => subjectName, 'level' => skillLevel });
            }
        }
 
        Account a = new Account(
            FirstName    = firstName,
            LastName     = lastName,
            PersonEmail  = email,
            Type         = resolveAccountType(teachingType),
            RecordTypeId = personRtId
        );
 
        // Contact
        if (String.isNotBlank(phone))        a.Phone               = phone;
        if (String.isNotBlank(address))      a.PersonMailingStreet = address;
 
        // Personal
        if (String.isNotBlank(gender))        a.PersonGenderIdentity           = gender;
        if (String.isNotBlank(qual))          a.Qualification__c    = qual;
        if (String.isNotBlank(employeeId))    a.Employee_ID__c      = employeeId;
        if (String.isNotBlank(designation))   a.Designation__c      = designation;
        if (String.isNotBlank(subjectTaught)) a.Subject_Taught__c   = subjectTaught;
        if (String.isNotBlank(staffStatus))   a.Staff_Status__c     = staffStatus;
 
        // Dates
        if (String.isNotBlank(dob))      { try { a.PersonBirthdate = Date.valueOf(dob);      } catch (Exception de) {} }
        if (String.isNotBlank(joinDate)) { try { a.Joining_Date__c = Date.valueOf(joinDate); } catch (Exception de) {} }
 
        // Salary
        if (String.isNotBlank(basicStr))  { try { a.Basic_Salary__c = Decimal.valueOf(basicStr);  } catch (Exception de) {} }
        if (String.isNotBlank(allowStr))  { try { a.Allowances__c   = Decimal.valueOf(allowStr);  } catch (Exception de) {} }
        if (String.isNotBlank(deductStr)) { try { a.Deductions__c   = Decimal.valueOf(deductStr); } catch (Exception de) {} }
        if (String.isNotBlank(daStr))     { try { a.DA__c           = Decimal.valueOf(daStr);     } catch (Exception de) {} }
        if (String.isNotBlank(hraStr))    { try { a.HRA__c          = Decimal.valueOf(hraStr);    } catch (Exception de) {} }
        if (String.isNotBlank(pfStr))     { try { a.PF_Deduction__c = Decimal.valueOf(pfStr);     } catch (Exception de) {} }
 
        // Bank
        if (String.isNotBlank(bankAccStr)) a.Bank_Account_Number__c = bankAccStr;
        if (String.isNotBlank(ifscStr))    a.IFSC_Code__c           = ifscStr;
 
        toInsert.add(a);
        skillMatrix.add(rowSkills);
        existingEmails.add(email.toLowerCase());
        rowNum++;
    }
 
    Integer created       = 0;
    Integer skillsCreated = 0;
    List<Teacher_Skill__c> skillRecords = new List<Teacher_Skill__c>();
 
    if (!toInsert.isEmpty()) {
        Database.SaveResult[] results = Database.insert(toInsert, false);
        for (Integer i = 0; i < results.size(); i++) {
            if (results[i].isSuccess()) {
                created++;
                Id     accountId = results[i].getId();
                String fullName  = toInsert[i].FirstName + ' ' + toInsert[i].LastName;
                for (Map<String,String> sk : skillMatrix[i]) {
                    String lookupKey = sk.get('subjectName').toLowerCase().trim();
                    Id subjectId = subjectNameToId.get(lookupKey);
                    if (subjectId == null) {
                        for (String key : subjectNameToId.keySet()) {
                            if (key.contains(lookupKey) || lookupKey.contains(key)) {
                                subjectId = subjectNameToId.get(key); break;
                            }
                        }
                    }
                    if (subjectId != null) {
                        skillRecords.add(new Teacher_Skill__c(
                            Name           = fullName + ' - ' + sk.get('subjectName'),
                            Teacher__c     = accountId,
                            Subject__c     = subjectId,
                            Skill_Level__c = sk.get('level')
                        ));
                    }
                }
            } else {
                errorRows.add(toInsert[i].FirstName + ' ' + toInsert[i].LastName + ': ' +
                              results[i].getErrors()[0].getMessage());
            }
        }
    }
 
    if (!skillRecords.isEmpty()) {
        Database.SaveResult[] skillResults = Database.insert(skillRecords, false);
        for (Database.SaveResult sr : skillResults) { if (sr.isSuccess()) skillsCreated++; }
    }
 
    return new Map<String, Object>{
        'created'       => created,
        'skipped'       => skipped.size(),
        'errors'        => errorRows.size(),
        'errorDetails'  => errorRows,
        'skippedNames'  => skipped,
        'skillsCreated' => skillsCreated
    };
}

    /* ═══════════════════════════════════════════════════════════════
       GET PERIOD TIMINGS FROM CUSTOM OBJECT
       ═══════════════════════════════════════════════════════════════ */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getPeriodTimings() {
        List<Map<String, Object>> result = new List<Map<String, Object>>();
        try {
            List<Period_Timing__c> timings = [
                SELECT Id, Name, Period_Number__c, Start_Time__c, End_Time__c
                FROM Period_Timing__c
                WHERE Is_Active__c = true
                ORDER BY Period_Number__c ASC
            ];
            for (Period_Timing__c pt : timings) {
                String startTime = formatTime(pt.Start_Time__c);
                String endTime   = formatTime(pt.End_Time__c);
                result.add(new Map<String, Object>{
                    'id'        => pt.Id,
                    'num'       => Integer.valueOf(pt.Period_Number__c),
                    'label'     => pt.Name,
                    'startTime' => startTime,
                    'endTime'   => endTime,
                    'timeLabel' => startTime + (endTime != '' ? ' – ' + endTime : '')
                });
            }
        } catch (Exception e) {
            System.debug('getPeriodTimings error: ' + e.getMessage());
        }
        return result;
    }

    private static String formatTime(Time t) {
        if (t == null) return '';
        return DateTime.newInstance(Date.today(), t).format('h:mm a');
    }

    /* ═══════════════════════════════════════════════════════════════
       CHECK DUPLICATE CLASS SECTION
       ═══════════════════════════════════════════════════════════════ */
    @AuraEnabled(cacheable=false)
    public static Boolean checkDuplicateClassSection(
        String academicYearId,
        String classId,
        String sectionId
    ) {
        if (String.isBlank(academicYearId) || String.isBlank(classId) || String.isBlank(sectionId)) {
            return false;
        }
        List<Class_Section__c> existing = [
            SELECT Id
            FROM Class_Section__c
            WHERE Academic_Year__c = :academicYearId
            AND   Class__c         = :classId
            AND   Section__c       = :sectionId
            LIMIT 1
        ];
        return !existing.isEmpty();
    }

    /* ═══════════════════════════════════════════════════════════════
       GET TEACHERS FOR SUBJECT (via Teacher_Skill__c)
       ═══════════════════════════════════════════════════════════════ */
    @AuraEnabled(cacheable=true)
    public static Map<String, List<Map<String, String>>> getTeachersForSubject(
        List<String> subjectIds,
        String className
    ) {
        Map<String, List<Map<String, String>>> teachersBySubject =
            new Map<String, List<Map<String, String>>>();

        List<Teacher_Skill__c> skills = [
            SELECT Id, Subject__c, Subject__r.Name,
                   Teacher__c, Teacher__r.Name, Skill_Level__c
            FROM Teacher_Skill__c
            WHERE Subject__c IN :subjectIds
            ORDER BY Teacher__r.Name
        ];

        for (Teacher_Skill__c ts : skills) {
            String subjectId = ts.Subject__c;
            if (!teachersBySubject.containsKey(subjectId)) {
                teachersBySubject.put(subjectId, new List<Map<String, String>>());
            }
            teachersBySubject.get(subjectId).add(new Map<String, String>{
                'Id'               => ts.Teacher__c,
                'Name'             => ts.Teacher__r.Name,
                'Teacher_Skill__c' => String.isNotBlank(ts.Skill_Level__c) ? ts.Skill_Level__c : 'Qualified'
            });
        }
        return teachersBySubject;
    }

    /* ═══════════════════════════════════════════════════════════════
       CREATE CLASS SECTION
       ═══════════════════════════════════════════════════════════════ */
    @AuraEnabled
    public static Map<String, Object> createClassSection(
        String              academicYearId,
        String              classId,
        String              sectionId,
        Integer             classStrength,
        Map<String, Object> subjectTeacherMap,
        Map<String, Object> subjectPeriodsMap
    ) {
        Savepoint sp = Database.setSavepoint();
        try {
            if (String.isBlank(academicYearId) || String.isBlank(classId) || String.isBlank(sectionId)) {
                throw new AuraHandledException('Academic Year, Class, and Section are required.');
            }

            List<Class_Section__c> existing = [
                SELECT Id FROM Class_Section__c
                WHERE Academic_Year__c = :academicYearId
                AND   Class__c         = :classId
                AND   Section__c       = :sectionId
                LIMIT 1
            ];
            if (!existing.isEmpty()) {
                throw new AuraHandledException(
                    'This Class and Section combination already exists for the selected academic year. ' +
                    'Please choose a different combination.'
                );
            }

            String className   = [SELECT Name FROM Class__c   WHERE Id = :classId   LIMIT 1].Name;
            String sectionName = [SELECT Name FROM Section__c WHERE Id = :sectionId LIMIT 1].Name;

            Class_Section__c cs = new Class_Section__c(
                Name             = className + ' - ' + sectionName,
                Class__c         = classId,
                Section__c       = sectionId,
                Academic_Year__c = academicYearId
            );
            if (classStrength != null) cs.Class_Strength__c = classStrength;
            insert cs;

            Set<String> subjectIdSet = subjectTeacherMap.keySet();
            Map<Id, String> subjectNameMap = new Map<Id, String>();
            for (Subject__c sub : [SELECT Id, Name FROM Subject__c WHERE Id IN :subjectIdSet]) {
                subjectNameMap.put(sub.Id, sub.Name);
            }

            List<Class_Subject__c> classSubjects = new List<Class_Subject__c>();
            for (String subjectId : subjectTeacherMap.keySet()) {
                String subjectName = subjectNameMap.containsKey((Id) subjectId)
                    ? subjectNameMap.get((Id) subjectId) : subjectId;
                classSubjects.add(new Class_Subject__c(
                    Name             = className + ' ' + sectionName + ' - ' + subjectName,
                    Class_Section__c = cs.Id,
                    Subject__c       = subjectId
                ));
            }
            if (!classSubjects.isEmpty()) insert classSubjects;

            Set<String> allTeacherIds = new Set<String>();
            for (String subjectId : subjectTeacherMap.keySet()) {
                for (Object t : (List<Object>) subjectTeacherMap.get(subjectId)) {
                    allTeacherIds.add((String) t);
                }
            }
            Map<Id, String> teacherNameMap = new Map<Id, String>();
            for (Account acc : [SELECT Id, Name FROM Account WHERE Id IN :allTeacherIds]) {
                teacherNameMap.put(acc.Id, acc.Name);
            }

            List<Teacher_Assignment__c> assignments = new List<Teacher_Assignment__c>();
            for (String subjectId : subjectTeacherMap.keySet()) {
                String subjectName = subjectNameMap.containsKey((Id) subjectId)
                    ? subjectNameMap.get((Id) subjectId) : subjectId;

                List<Object> teacherIds   = (List<Object>) subjectTeacherMap.get(subjectId);
                List<Object> periodValues = subjectPeriodsMap != null && subjectPeriodsMap.containsKey(subjectId)
                    ? (List<Object>) subjectPeriodsMap.get(subjectId)
                    : null;

                for (Integer i = 0; i < teacherIds.size(); i++) {
                    String teacherId   = (String) teacherIds[i];
                    String teacherName = teacherNameMap.containsKey((Id) teacherId)
                        ? teacherNameMap.get((Id) teacherId) : teacherId;
                    Integer periods = 5;
                    if (periodValues != null && i < periodValues.size() && periodValues[i] != null) {
                        periods = Integer.valueOf(String.valueOf(periodValues[i]));
                    }
                    assignments.add(new Teacher_Assignment__c(
                        Name                = className + ' ' + sectionName + ' - ' + subjectName + ' - ' + teacherName,
                        Class_Section__c    = cs.Id,
                        Subject__c          = subjectId,
                        Teacher__c          = teacherId,
                        Academic_Year__c    = academicYearId,
                        Periods_Per_Week__c = periods
                    ));
                }
            }
            if (!assignments.isEmpty()) insert assignments;

            return new Map<String, Object>{
                'classSectionId'         => cs.Id,
                'subjectCount'           => classSubjects.size(),
                'teacherAssignmentCount' => assignments.size()
            };

        } catch (Exception e) {
            Database.rollback(sp);
            throw new AuraHandledException('Error creating class section: ' + e.getMessage());
        }
    }

private static String resolveAccountType(String teachingType) {
    if (String.isBlank(teachingType)) return 'Teacher';
    if (teachingType.trim().equalsIgnoreCase('Non-Teaching')) return 'Non-Teaching';
    return 'Teacher';
}

    /* ═══════════════════════════════════════════════════════════════
       CREATE TEACHER WITH SKILLS
       ═══════════════════════════════════════════════════════════════ */
   @AuraEnabled
public static Map<String, Object> createTeacherWithSkills(
    String  firstName,      String  lastName,
    String  email,          String  phone,
    String  qualification,  String  gender,
    String  dateOfBirth,    String  joiningDate,
    String  address,        String  teachingType,
    Decimal basicSalary,    Decimal allowances,
    Decimal deductions,     Decimal da,
    Decimal hra,            Decimal pfDeduction,
    String  employeeId,     String  designation,
    String  subjectTaught,  String  staffStatus,
    String  bankAccountNumber,
    String  ifscCode,
    List<Map<String, Object>> skills
) {
    Savepoint sp = Database.setSavepoint();
    try {
        if (String.isBlank(firstName) || String.isBlank(lastName))
            throw new AuraHandledException('First Name and Last Name are required.');
        if (String.isBlank(email))
            throw new AuraHandledException('Email is required.');
        if (skills == null || skills.isEmpty())
            throw new AuraHandledException('At least one subject skill is required.');
 
        List<Account> existing = [
            SELECT Id FROM Account
            WHERE PersonEmail = :email AND IsPersonAccount = true LIMIT 1
        ];
        if (!existing.isEmpty())
            throw new AuraHandledException('A teacher with this email already exists.');
 
        Id personRtId = [
            SELECT Id FROM RecordType
            WHERE SObjectType = 'Account' AND IsPersonType = true LIMIT 1
        ].Id;
 
        Account teacher = new Account(
            FirstName    = firstName,
            LastName     = lastName,
            PersonEmail  = email,
            Type         = resolveAccountType(teachingType),
            RecordTypeId = personRtId
        );
 
        // Contact
        if (String.isNotBlank(phone))             teacher.Phone                   = phone;
        if (String.isNotBlank(address))           teacher.PersonMailingStreet     = address;
 
        // Personal
        if (String.isNotBlank(gender))            teacher.PersonGenderIdentity               = gender;
        if (String.isNotBlank(qualification))     teacher.Qualification__c        = qualification;
        if (String.isNotBlank(employeeId))        teacher.Employee_ID__c          = employeeId;
        if (String.isNotBlank(designation))       teacher.Designation__c          = designation;
        if (String.isNotBlank(subjectTaught))     teacher.Subject_Taught__c       = subjectTaught;
        if (String.isNotBlank(staffStatus))       teacher.Staff_Status__c         = staffStatus;
 
        // Dates
        if (String.isNotBlank(dateOfBirth)) {
            try { teacher.PersonBirthdate = Date.valueOf(dateOfBirth); } catch (Exception de) {}
        }
        if (String.isNotBlank(joiningDate)) {
            try { teacher.Joining_Date__c = Date.valueOf(joiningDate); } catch (Exception de) {}
        }
 
        // Salary
        if (basicSalary != null)  teacher.Basic_Salary__c  = basicSalary;
        if (allowances  != null)  teacher.Allowances__c    = allowances;
        if (deductions  != null)  teacher.Deductions__c    = deductions;
        if (da          != null)  teacher.DA__c            = da;
        if (hra         != null)  teacher.HRA__c           = hra;
        if (pfDeduction != null)  teacher.PF_Deduction__c  = pfDeduction;
 
        // Bank
        if (String.isNotBlank(bankAccountNumber)) teacher.Bank_Account_Number__c = bankAccountNumber;
        if (String.isNotBlank(ifscCode))          teacher.IFSC_Code__c           = ifscCode;
 
        insert teacher;
 
        // Skills
        Set<String> skillSubjectIds = new Set<String>();
        for (Map<String, Object> s : skills) {
            if (String.isNotBlank((String) s.get('subjectId')))
                skillSubjectIds.add((String) s.get('subjectId'));
        }
        Map<Id, String> subjectNameMap = new Map<Id, String>();
        for (Subject__c sub : [SELECT Id, Name FROM Subject__c WHERE Id IN :skillSubjectIds]) {
            subjectNameMap.put(sub.Id, sub.Name);
        }
 
        String fullName = firstName + ' ' + lastName;
        List<Teacher_Skill__c> teacherSkills = new List<Teacher_Skill__c>();
        for (Map<String, Object> s : skills) {
            String subjectId  = (String) s.get('subjectId');
            String skillLevel = (String) s.get('skillLevel');
            Object yearsExp   = s.get('yearsOfExperience');
            if (String.isNotBlank(subjectId) && String.isNotBlank(skillLevel)) {
                String subjectName = subjectNameMap.containsKey((Id) subjectId)
                    ? subjectNameMap.get((Id) subjectId) : subjectId;
                Teacher_Skill__c ts = new Teacher_Skill__c(
                    Name           = fullName + ' - ' + subjectName,
                    Teacher__c     = teacher.Id,
                    Subject__c     = subjectId,
                    Skill_Level__c = skillLevel
                );
                if (yearsExp != null) {
                    try { ts.Years_of_Experience__c = Decimal.valueOf(String.valueOf(yearsExp)); } catch (Exception ex) {}
                }
                teacherSkills.add(ts);
            }
        }
        if (!teacherSkills.isEmpty()) insert teacherSkills;
 
        return new Map<String, Object>{
            'teacherId'   => teacher.Id,
            'teacherName' => fullName,
            'skillsCount' => teacherSkills.size()
        };
 
    } catch (DmlException e) {
        Database.rollback(sp);
        throw new AuraHandledException('Database error: ' + e.getDmlMessage(0));
    } catch (Exception e) {
        Database.rollback(sp);
        throw new AuraHandledException(e.getMessage());
    }
}
    /* ═══════════════════════════════════════════════════════════════
       GET SKILL LEVEL OPTIONS
       ═══════════════════════════════════════════════════════════════ */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getSkillLevelOptions() {
        List<Map<String, String>> options = new List<Map<String, String>>();
        try {
            for (Schema.PicklistEntry e :
                Teacher_Skill__c.Skill_Level__c.getDescribe().getPicklistValues()) {
                if (e.isActive()) {
                    options.add(new Map<String, String>{
                        'label' => e.getLabel(),
                        'value' => e.getValue()
                    });
                }
            }
        } catch (Exception e) { /* fall through */ }

        if (options.isEmpty()) {
            options.add(new Map<String, String>{ 'label' => 'Beginner',     'value' => 'Beginner' });
            options.add(new Map<String, String>{ 'label' => 'Intermediate', 'value' => 'Intermediate' });
            options.add(new Map<String, String>{ 'label' => 'Advanced',     'value' => 'Advanced' });
            options.add(new Map<String, String>{ 'label' => 'Expert',       'value' => 'Expert' });
        }
        return options;
    }

    /* ═══════════════════════════════════════════════════════════════
       WORKLOAD SUMMARY
       ═══════════════════════════════════════════════════════════════ */
    @AuraEnabled(cacheable=false)
    public static Map<String, Object> getWorkloadSummary(String academicYearId) {
        Integer classSections, totalAssignments;

        if (String.isNotBlank(academicYearId)) {
            classSections    = [SELECT COUNT() FROM Class_Section__c WHERE Academic_Year__c = :academicYearId];
            totalAssignments = [SELECT COUNT() FROM Teacher_Assignment__c WHERE Academic_Year__c = :academicYearId];
        } else {
            classSections    = [SELECT COUNT() FROM Class_Section__c];
            totalAssignments = [SELECT COUNT() FROM Teacher_Assignment__c];
        }

        List<AggregateResult> teacherAgg;
        if (String.isNotBlank(academicYearId)) {
            teacherAgg = [SELECT COUNT_DISTINCT(Teacher__c) cnt FROM Teacher_Assignment__c WHERE Academic_Year__c = :academicYearId];
        } else {
            teacherAgg = [SELECT COUNT_DISTINCT(Teacher__c) cnt FROM Teacher_Assignment__c];
        }

        Integer teacherCount = teacherAgg.isEmpty() ? 0 : Integer.valueOf(teacherAgg[0].get('cnt'));
        Decimal avgLoad = 0;
        if (teacherCount > 0 && totalAssignments > 0) {
            avgLoad = Math.min(
                (Decimal.valueOf(totalAssignments) / Decimal.valueOf(teacherCount) / 8 * 100).setScale(0),
                100
            );
        }

        return new Map<String, Object>{
            'totalClassSections' => classSections,
            'totalTeachers'      => teacherCount,
            'totalAssignments'   => totalAssignments,
            'avgLoadPercent'     => Integer.valueOf(avgLoad)
        };
    }

    @AuraEnabled(cacheable=false)
    public static List<Map<String, Object>> getAllTeacherWorkloads() {
        List<Account> teachers = [
            SELECT Id, Name FROM Account
            WHERE Type = 'Teacher' AND IsPersonAccount = true
            ORDER BY Name
        ];
        if (teachers.isEmpty()) return new List<Map<String, Object>>();

        Set<Id> teacherIds = new Map<Id, Account>(teachers).keySet();

        List<AggregateResult> periodAgg = [
            SELECT Assigned_Teacher__c                tId,
                   COUNT(Id)                          totalPeriods,
                   COUNT_DISTINCT(Subjects__c)        subjectCount,
                   COUNT_DISTINCT(Class_Section__c)   classCount
            FROM Period__c
            WHERE Assigned_Teacher__c IN :teacherIds
              AND Assigned_Teacher__c != null
            GROUP BY Assigned_Teacher__c
        ];

        Map<Id, AggregateResult> periodAggMap = new Map<Id, AggregateResult>();
        for (AggregateResult ar : periodAgg) {
            periodAggMap.put((Id) ar.get('tId'), ar);
        }

        List<AggregateResult> assignAgg = [
            SELECT Teacher__c                        tId,
                   COUNT_DISTINCT(Subject__c)        subjectCount,
                   COUNT_DISTINCT(Class_Section__c)  classCount,
                   SUM(Periods_Per_Week__c)          totalPeriods
            FROM Teacher_Assignment__c
            WHERE Teacher__c IN :teacherIds
            GROUP BY Teacher__c
        ];
        Map<Id, AggregateResult> assignAggMap = new Map<Id, AggregateResult>();
        for (AggregateResult ar : assignAgg) {
            assignAggMap.put((Id) ar.get('tId'), ar);
        }

        Integer MAX_WEEKLY_PERIODS = 48;

        List<Map<String, Object>> result = new List<Map<String, Object>>();
        for (Account t : teachers) {
            Integer totalPeriods = 0;
            Integer subjectCnt   = 0;
            Integer classCnt     = 0;

            if (periodAggMap.containsKey(t.Id)) {
                AggregateResult ar = periodAggMap.get(t.Id);
                totalPeriods = ar.get('totalPeriods') != null ? Integer.valueOf(ar.get('totalPeriods')) : 0;
                subjectCnt   = ar.get('subjectCount') != null ? Integer.valueOf(ar.get('subjectCount')) : 0;
                classCnt     = ar.get('classCount')   != null ? Integer.valueOf(ar.get('classCount'))   : 0;
            } else if (assignAggMap.containsKey(t.Id)) {
                AggregateResult ar = assignAggMap.get(t.Id);
                Decimal p    = ar.get('totalPeriods') != null ? (Decimal) ar.get('totalPeriods') : 0;
                totalPeriods = Integer.valueOf(p);
                subjectCnt   = ar.get('subjectCount') != null ? Integer.valueOf(ar.get('subjectCount')) : 0;
                classCnt     = ar.get('classCount')   != null ? Integer.valueOf(ar.get('classCount'))   : 0;
            }

            Integer loadPct = Integer.valueOf(
                Math.min(
                    (Decimal.valueOf(totalPeriods) / MAX_WEEKLY_PERIODS * 100).setScale(0),
                    100
                )
            );

            result.add(new Map<String, Object>{
                'teacherId'    => t.Id,
                'teacherName'  => t.Name,
                'subjectCount' => subjectCnt,
                'classCount'   => classCnt,
                'totalPeriods' => totalPeriods,
                'loadPercent'  => loadPct
            });
        }
        return result;
    }

    @AuraEnabled(cacheable=false)
    public static List<Map<String, Object>> getAllClassWorkloads() {
        List<Class_Section__c> sections = [
            SELECT Id, Name, Academic_Year__c, Academic_Year__r.Name
            FROM Class_Section__c
            ORDER BY Name
        ];
        if (sections.isEmpty()) return new List<Map<String, Object>>();

        Set<Id> sectionIds = new Map<Id, Class_Section__c>(sections).keySet();

        List<AggregateResult> subjectAgg = [
            SELECT Class_Section__c csId, COUNT(Id) cnt
            FROM Class_Subject__c
            WHERE Class_Section__c IN :sectionIds
            GROUP BY Class_Section__c
        ];
        Map<Id, Integer> subjectCountMap = new Map<Id, Integer>();
        for (AggregateResult ar : subjectAgg) {
            subjectCountMap.put((Id) ar.get('csId'), Integer.valueOf(ar.get('cnt')));
        }

        List<AggregateResult> staffedAgg = [
            SELECT Class_Section__c csId, COUNT_DISTINCT(Subject__c) cnt
            FROM Teacher_Assignment__c
            WHERE Class_Section__c IN :sectionIds
            GROUP BY Class_Section__c
        ];
        Map<Id, Integer> staffedCountMap = new Map<Id, Integer>();
        for (AggregateResult ar : staffedAgg) {
            staffedCountMap.put((Id) ar.get('csId'), Integer.valueOf(ar.get('cnt')));
        }

        List<Map<String, Object>> result = new List<Map<String, Object>>();
        for (Class_Section__c cs : sections) {
            Integer totalSubjects   = subjectCountMap.containsKey(cs.Id) ? subjectCountMap.get(cs.Id) : 0;
            Integer staffedSubjects = staffedCountMap.containsKey(cs.Id) ? staffedCountMap.get(cs.Id) : 0;
            Integer loadPct = totalSubjects > 0
                ? Integer.valueOf((Decimal.valueOf(staffedSubjects) / Decimal.valueOf(totalSubjects) * 100).setScale(0))
                : 0;
            result.add(new Map<String, Object>{
                'classSectionId' => cs.Id,
                'name'           => cs.Name,
                'academicYear'   => cs.Academic_Year__r != null ? cs.Academic_Year__r.Name : '',
                'subjectCount'   => totalSubjects,
                'staffedCount'   => staffedSubjects,
                'loadPercent'    => loadPct
            });
        }
        return result;
    }

    @AuraEnabled(cacheable=false)
    public static Map<String, Object> getTeacherWorkload(String teacherId) {
        if (String.isBlank(teacherId)) throw new AuraHandledException('Teacher ID is required.');

        Account teacher = [SELECT Id, Name FROM Account WHERE Id = :teacherId LIMIT 1];

        List<Teacher_Assignment__c> assignments = [
            SELECT Id, Name,
                   Subject__c, Subject__r.Name,
                   Class_Section__c, Class_Section__r.Name,
                   Academic_Year__c, Academic_Year__r.Name,
                   Periods_Per_Week__c
            FROM Teacher_Assignment__c
            WHERE Teacher__c = :teacherId
            ORDER BY Class_Section__r.Name, Subject__r.Name
        ];

        List<AggregateResult> periodAgg = [
            SELECT Class_Section__c   csId,
                   Subjects__c        subjId,
                   COUNT(Id)          cnt
            FROM Period__c
            WHERE Assigned_Teacher__c = :teacherId
              AND Class_Section__c   != null
              AND Subjects__c        != null
            GROUP BY Class_Section__c, Subjects__c
        ];

        Map<String, Integer> periodCountMap = new Map<String, Integer>();
        for (AggregateResult ar : periodAgg) {
            String key = String.valueOf(ar.get('csId')) + '|' + String.valueOf(ar.get('subjId'));
            periodCountMap.put(key, Integer.valueOf(ar.get('cnt')));
        }

        Map<String, List<Teacher_Assignment__c>> bySection = new Map<String, List<Teacher_Assignment__c>>();
        for (Teacher_Assignment__c ta : assignments) {
            String k = ta.Class_Section__c;
            if (!bySection.containsKey(k)) bySection.put(k, new List<Teacher_Assignment__c>());
            bySection.get(k).add(ta);
        }

        List<Map<String, Object>> classes = new List<Map<String, Object>>();
        for (String csId : bySection.keySet()) {
            List<Teacher_Assignment__c> tas = bySection.get(csId);
            Teacher_Assignment__c first = tas[0];

            List<Map<String, Object>> subjList = new List<Map<String, Object>>();
            for (Teacher_Assignment__c ta : tas) {
                String countKey = String.valueOf(ta.Class_Section__c) + '|' + String.valueOf(ta.Subject__c);
                Integer timetableCount = periodCountMap.containsKey(countKey)
                    ? periodCountMap.get(countKey) : null;

                Integer periodsToShow = timetableCount != null
                    ? timetableCount
                    : (ta.Periods_Per_Week__c != null ? Integer.valueOf(ta.Periods_Per_Week__c) : 0);

                subjList.add(new Map<String, Object>{
                    'assignmentId'   => ta.Id,
                    'subjectId'      => ta.Subject__c,
                    'subjectName'    => ta.Subject__r.Name,
                    'periodsPerWeek' => periodsToShow,
                    'fromTimetable'  => (timetableCount != null)
                });
            }

            classes.add(new Map<String, Object>{
                'classSectionId' => csId,
                'className'      => first.Class_Section__r.Name,
                'academicYear'   => first.Academic_Year__r != null ? first.Academic_Year__r.Name : '',
                'subjects'       => subjList
            });
        }

        return new Map<String, Object>{
            'teacherName' => teacher.Name,
            'classes'     => classes
        };
    }

    /* ═══════════════════════════════════════════════════════════════
       GET CLASS SECTION WORKLOAD
       ═══════════════════════════════════════════════════════════════ */
    @AuraEnabled(cacheable=false)
    public static Map<String, Object> getClassSectionWorkload(String classSectionId) {
        if (String.isBlank(classSectionId)) throw new AuraHandledException('Class Section ID is required.');

        Class_Section__c cs = [
            SELECT Id, Name, Academic_Year__c, Academic_Year__r.Name
            FROM Class_Section__c
            WHERE Id = :classSectionId LIMIT 1
        ];

        List<Class_Subject__c> classSubjects = [
            SELECT Id, Subject__c, Subject__r.Name
            FROM Class_Subject__c
            WHERE Class_Section__c = :classSectionId
            ORDER BY Subject__r.Name
        ];

        List<Teacher_Assignment__c> assignments = [
            SELECT Id, Subject__c,
                   Teacher__c, Teacher__r.Name,
                   Periods_Per_Week__c
            FROM Teacher_Assignment__c
            WHERE Class_Section__c = :classSectionId
            ORDER BY Teacher__r.Name
        ];

        List<AggregateResult> periodAgg = [
            SELECT Subjects__c          subjId,
                   Assigned_Teacher__c  tId,
                   COUNT(Id)            cnt
            FROM Period__c
            WHERE Class_Section__c    = :classSectionId
              AND Subjects__c        != null
              AND Assigned_Teacher__c != null
            GROUP BY Subjects__c, Assigned_Teacher__c
        ];

        Map<String, Integer> periodCountMap = new Map<String, Integer>();
        for (AggregateResult ar : periodAgg) {
            String key = String.valueOf(ar.get('subjId')) + '|' + String.valueOf(ar.get('tId'));
            periodCountMap.put(key, Integer.valueOf(ar.get('cnt')));
        }

        Map<String, List<Teacher_Assignment__c>> bySubject = new Map<String, List<Teacher_Assignment__c>>();
        Set<String> teacherIds = new Set<String>();
        for (Teacher_Assignment__c ta : assignments) {
            if (!bySubject.containsKey(ta.Subject__c))
                bySubject.put(ta.Subject__c, new List<Teacher_Assignment__c>());
            bySubject.get(ta.Subject__c).add(ta);
            teacherIds.add(ta.Teacher__c);
        }

        List<Map<String, Object>> subjects = new List<Map<String, Object>>();
        for (Class_Subject__c csub : classSubjects) {
            List<Map<String, Object>> teacherList = new List<Map<String, Object>>();
            List<Teacher_Assignment__c> subjTas = bySubject.get(csub.Subject__c);
            if (subjTas != null) {
                for (Teacher_Assignment__c ta : subjTas) {
                    String countKey = String.valueOf(ta.Subject__c) + '|' + String.valueOf(ta.Teacher__c);
                    Integer timetableCount = periodCountMap.containsKey(countKey)
                        ? periodCountMap.get(countKey) : null;

                    Integer periodsToShow = timetableCount != null
                        ? timetableCount
                        : (ta.Periods_Per_Week__c != null ? Integer.valueOf(ta.Periods_Per_Week__c) : 0);

                    teacherList.add(new Map<String, Object>{
                        'teacherId'      => ta.Teacher__c,
                        'teacherName'    => ta.Teacher__r.Name,
                        'assignmentId'   => ta.Id,
                        'periodsPerWeek' => periodsToShow,
                        'fromTimetable'  => (timetableCount != null)
                    });
                }
            }
            subjects.add(new Map<String, Object>{
                'subjectId'   => csub.Subject__c,
                'subjectName' => csub.Subject__r.Name,
                'teachers'    => teacherList
            });
        }

        return new Map<String, Object>{
            'name'         => cs.Name,
            'academicYear' => cs.Academic_Year__r != null ? cs.Academic_Year__r.Name : '',
            'teacherCount' => teacherIds.size(),
            'subjects'     => subjects
        };
    }

    @AuraEnabled
    public static void updateTeacherAssignment(
        String  assignmentId,
        String  newTeacherId,
        Integer periodsPerWeek
    ) {
        if (String.isBlank(assignmentId)) throw new AuraHandledException('Assignment ID is required.');

        Teacher_Assignment__c ta = [
            SELECT Id, Teacher__c, Subject__r.Name, Class_Section__r.Name
            FROM Teacher_Assignment__c
            WHERE Id = :assignmentId LIMIT 1
        ];

        if (String.isNotBlank(newTeacherId)) {
            ta.Teacher__c = newTeacherId;
            Account newTeacher = [SELECT Id, Name FROM Account WHERE Id = :newTeacherId LIMIT 1];
            ta.Name = ta.Class_Section__r.Name + ' - ' + ta.Subject__r.Name + ' - ' + newTeacher.Name;
        }
        if (periodsPerWeek != null) ta.Periods_Per_Week__c = periodsPerWeek;
        update ta;
    }

    @AuraEnabled
    public static void deleteTeacherAssignment(String assignmentId) {
        if (String.isBlank(assignmentId)) throw new AuraHandledException('Assignment ID is required.');
        delete [SELECT Id FROM Teacher_Assignment__c WHERE Id = :assignmentId LIMIT 1];
    }

    /* ═══════════════════════════════════════════════════════════════
       HELPER: Build a name→Id map for ALL active subjects.
       ═══════════════════════════════════════════════════════════════ */
    private static Map<String, Id> buildSubjectNameToIdMap() {
        Map<String, Id> nameToId = new Map<String, Id>();
        for (Subject__c s : [SELECT Id, Name FROM Subject__c WHERE Is_Active__c = true]) {
            nameToId.put(s.Name.toLowerCase(), s.Id);
        }
        return nameToId;
    }

    /* ═══════════════════════════════════════════════════════════════
       GET LEASER PERIODS FOR TEACHER
       ═══════════════════════════════════════════════════════════════ */
    @AuraEnabled(cacheable=false)
    public static List<String> getLeaserPeriodsForTeacher(String teacherId) {
        if (String.isBlank(teacherId)) return new List<String>();
        List<String> leaserIds = new List<String>();
        try {
            for (Period__c p : [
                SELECT Id
                FROM Period__c
                WHERE Assigned_Teacher__c = :teacherId
                  AND Is_Leaser__c        = true
                ORDER BY Day__c, Period_Number__c
            ]) {
                leaserIds.add(p.Id);
            }
        } catch (Exception e) {
            System.debug('getLeaserPeriodsForTeacher: ' + e.getMessage());
        }
        return leaserIds;
    }

    /* ═══════════════════════════════════════════════════════════════
       GET PERIODS FOR TEACHER
       ═══════════════════════════════════════════════════════════════ */
    @AuraEnabled(cacheable=false)
    public static List<Map<String, Object>> getPeriodsForTeacher(String teacherId) {
        if (String.isBlank(teacherId)) {
            return new List<Map<String, Object>>();
        }

        try {
            List<Period__c> periods = [
                SELECT Id, Day__c, Period_Number__c,
                       Subjects__c, Subjects__r.Name,
                       Subject__c,
                       Class_Section__c, Class_Section__r.Name,
                       Academic_Year__c, Academic_Year__r.Name,
                       Start_Date__c, End_Date__c,
                       Frequency__c,
                       Start_Time__c, End_Time__c,
                       Is_Leaser__c,
                       Assigned_Teacher__c, Assigned_Teacher__r.Name
                FROM Period__c
                WHERE Assigned_Teacher__c = :teacherId
                ORDER BY Day__c, Period_Number__c
            ];

            Map<String, Id> subjectNameToId = buildSubjectNameToIdMap();
            List<Map<String, Object>> result = new List<Map<String, Object>>();

            for (Period__c p : periods) {
                Map<String, Object> row = new Map<String, Object>();

                row.put('periodId',       p.Id);
                row.put('day',            p.Day__c);
                row.put('periodNumber',   p.Period_Number__c);
                row.put('classSectionId', p.Class_Section__c);
                row.put('className',      p.Class_Section__r != null ? p.Class_Section__r.Name : '');
                row.put('academicYearId', p.Academic_Year__c);
                row.put('academicYear',   p.Academic_Year__r != null ? p.Academic_Year__r.Name : '');
                row.put('startDate',      p.Start_Date__c != null ? String.valueOf(p.Start_Date__c) : '');
                row.put('endDate',        p.End_Date__c   != null ? String.valueOf(p.End_Date__c)   : '');
                row.put('frequency',      p.Frequency__c);
                row.put('isLeaser',       p.Is_Leaser__c == true);

                if (p.Assigned_Teacher__c != null && p.Assigned_Teacher__r != null) {
                    row.put('substituteTeacherId',   p.Assigned_Teacher__c);
                    row.put('substituteTeacherName', p.Assigned_Teacher__r.Name);
                } else {
                    row.put('substituteTeacherId',   null);
                    row.put('substituteTeacherName', null);
                }

                if (p.Start_Time__c != null) {
                    row.put('startTime', DateTime.newInstance(Date.today(), p.Start_Time__c).format('h:mm a'));
                } else {
                    row.put('startTime', '');
                }
                if (p.End_Time__c != null) {
                    row.put('endTime', DateTime.newInstance(Date.today(), p.End_Time__c).format('h:mm a'));
                } else {
                    row.put('endTime', '');
                }

                if (p.Subjects__c != null) {
                    row.put('subjectId',   p.Subjects__c);
                    row.put('subjectName', p.Subjects__r != null ? p.Subjects__r.Name : '');
                } else if (String.isNotBlank(p.Subject__c)) {
                    String pickVal = p.Subject__c;
                    Id resolvedId  = subjectNameToId.get(pickVal.toLowerCase());
                    row.put('subjectId',   resolvedId);
                    row.put('subjectName', pickVal);
                } else {
                    row.put('subjectId',   null);
                    row.put('subjectName', '—');
                }

                result.add(row);
            }
            return result;

        } catch (Exception e) {
            System.debug('getPeriodsForTeacher error: ' + e.getMessage());
            return new List<Map<String, Object>>();
        }
    }

    /* ═══════════════════════════════════════════════════════════════
       GET PERIODS FOR CLASS SECTION — FIXED
       ═══════════════════════════════════════════════════════════════ */
    @AuraEnabled(cacheable=false)
    public static List<Map<String, Object>> getPeriodsForClassSection(String classSectionId) {
        if (String.isBlank(classSectionId)) {
            return new List<Map<String, Object>>();
        }

        try {
            List<Period__c> periods;
            try {
                periods = [
                    SELECT Id, Day__c, Period_Number__c,
                           Subjects__c, Subjects__r.Name,
                           Subject__c,
                           Assigned_Teacher__c, Assigned_Teacher__r.Name,
                           Academic_Year__c, Academic_Year__r.Name,
                           Start_Date__c, End_Date__c,
                           Frequency__c,
                           Start_Time__c, End_Time__c,
                           Is_Leaser__c,
                           Substitute_Teacher__c, Substitute_Teacher__r.Name
                    FROM Period__c
                    WHERE Class_Section__c = :classSectionId
                    ORDER BY Day__c, Period_Number__c
                ];
            } catch (Exception queryEx) {
                periods = [
                    SELECT Id, Day__c, Period_Number__c,
                           Subjects__c, Subjects__r.Name,
                           Subject__c,
                           Assigned_Teacher__c, Assigned_Teacher__r.Name,
                           Academic_Year__c, Academic_Year__r.Name,
                           Start_Date__c, End_Date__c,
                           Frequency__c,
                           Start_Time__c, End_Time__c,
                           Is_Leaser__c
                    FROM Period__c
                    WHERE Class_Section__c = :classSectionId
                    ORDER BY Day__c, Period_Number__c
                ];
            }

            Map<Id, Id>     regularTeacherById   = new Map<Id, Id>();
            Map<Id, String> regularTeacherByName = new Map<Id, String>();

            for (Teacher_Assignment__c ta : [
                SELECT Teacher__c, Teacher__r.Name, Subject__c
                FROM Teacher_Assignment__c
                WHERE Class_Section__c = :classSectionId
            ]) {
                if (ta.Subject__c != null) {
                    regularTeacherById.put(ta.Subject__c,   ta.Teacher__c);
                    regularTeacherByName.put(ta.Subject__c, ta.Teacher__r.Name);
                }
            }

            Map<String, Id> subjectNameToId = buildSubjectNameToIdMap();
            List<Map<String, Object>> result = new List<Map<String, Object>>();

            for (Period__c p : periods) {
                Map<String, Object> row = new Map<String, Object>();

                row.put('periodId',       p.Id);
                row.put('day',            p.Day__c);
                row.put('periodNumber',   p.Period_Number__c);
                row.put('classSectionId', classSectionId);
                row.put('academicYearId', p.Academic_Year__c);
                row.put('academicYear',   p.Academic_Year__r != null ? p.Academic_Year__r.Name : '');
                row.put('startDate',      p.Start_Date__c != null ? String.valueOf(p.Start_Date__c) : '');
                row.put('endDate',        p.End_Date__c   != null ? String.valueOf(p.End_Date__c)   : '');
                row.put('frequency',      p.Frequency__c);

                if (p.Start_Time__c != null) {
                    row.put('startTime', DateTime.newInstance(Date.today(), p.Start_Time__c).format('h:mm a'));
                } else {
                    row.put('startTime', '');
                }
                if (p.End_Time__c != null) {
                    row.put('endTime', DateTime.newInstance(Date.today(), p.End_Time__c).format('h:mm a'));
                } else {
                    row.put('endTime', '');
                }

                Id subjectId = null;
                if (p.Subjects__c != null) {
                    subjectId = p.Subjects__c;
                    row.put('subjectId',   p.Subjects__c);
                    row.put('subjectName', p.Subjects__r != null ? p.Subjects__r.Name : '');
                } else if (String.isNotBlank(p.Subject__c)) {
                    Id resolvedId = subjectNameToId.get(p.Subject__c.toLowerCase());
                    subjectId     = resolvedId;
                    row.put('subjectId',   resolvedId);
                    row.put('subjectName', p.Subject__c);
                } else {
                    row.put('subjectId',   null);
                    row.put('subjectName', '—');
                }

                Boolean isLeaser     = (p.Is_Leaser__c == true);
                Boolean isSubstitute = false;
                String  substituteTeacherName = null;
                String  originalTeacherName   = null;
                String  teacherNameForCard    = null;

                Id     regularTeacherId   = (subjectId != null) ? regularTeacherById.get(subjectId)   : null;
                String regularTeacherName = (subjectId != null) ? regularTeacherByName.get(subjectId) : null;

                Id     subTeacherId   = null;
                String subTeacherName = null;
                try {
                    subTeacherId   = (Id)     p.get('Substitute_Teacher__c');
                    subTeacherName = subTeacherId != null
                        ? (String) p.getSObject('Substitute_Teacher__r').get('Name')
                        : null;
                } catch (Exception fieldEx) {}

                if (isLeaser) {
                    isSubstitute = true;
                    if (subTeacherId != null) {
                        substituteTeacherName = subTeacherName;
                        originalTeacherName   = p.Assigned_Teacher__r != null
                                                  ? p.Assigned_Teacher__r.Name
                                                  : regularTeacherName;
                    } else if (p.Assigned_Teacher__c != null
                               && regularTeacherId != null
                               && p.Assigned_Teacher__c != regularTeacherId) {
                        substituteTeacherName = p.Assigned_Teacher__r != null
                                                  ? p.Assigned_Teacher__r.Name : null;
                        originalTeacherName   = regularTeacherName;
                    } else {
                        substituteTeacherName = p.Assigned_Teacher__r != null
                                                  ? p.Assigned_Teacher__r.Name : null;
                        originalTeacherName   = regularTeacherName;
                    }
                    teacherNameForCard = substituteTeacherName != null
                                          ? substituteTeacherName : 'Sub TBD';

                } else if (subTeacherId != null) {
                    isSubstitute          = true;
                    substituteTeacherName = subTeacherName;
                    originalTeacherName   = p.Assigned_Teacher__r != null
                                              ? p.Assigned_Teacher__r.Name
                                              : regularTeacherName;
                    teacherNameForCard    = substituteTeacherName;

                } else if (subjectId != null
                           && p.Assigned_Teacher__c != null
                           && regularTeacherId != null
                           && p.Assigned_Teacher__c != regularTeacherId) {
                    isSubstitute          = true;
                    substituteTeacherName = p.Assigned_Teacher__r != null
                                              ? p.Assigned_Teacher__r.Name : null;
                    originalTeacherName   = regularTeacherName;
                    teacherNameForCard    = substituteTeacherName;

                } else {
                    teacherNameForCard = p.Assigned_Teacher__r != null
                                          ? p.Assigned_Teacher__r.Name : 'Unassigned';
                }

                row.put('teacherId',             p.Assigned_Teacher__c);
                row.put('teacherName',           teacherNameForCard != null ? teacherNameForCard : 'Unassigned');
                row.put('isLeaser',              isLeaser);
                row.put('isSubstitute',          isSubstitute);
                row.put('substituteTeacherName', substituteTeacherName);
                row.put('originalTeacherName',   originalTeacherName);
                row.put('isUnassigned',          p.Assigned_Teacher__c == null && subTeacherId == null);

                result.add(row);
            }

            return result;

        } catch (Exception e) {
            System.debug('getPeriodsForClassSection error: ' + e.getMessage()
                         + '\n' + e.getStackTraceString());
            return new List<Map<String, Object>>();
        }
    }

    /* ═══════════════════════════════════════════════════════════════
       TIMETABLE METHODS
       ═══════════════════════════════════════════════════════════════ */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getAllClassSections() {
        List<Map<String, Object>> result = new List<Map<String, Object>>();
        try {
            List<Class_Section__c> sections = [
                SELECT Id, Name,
                       Class__c, Class__r.Name,
                       Section__c, Section__r.Name,
                       Academic_Year__c, Academic_Year__r.Name
                FROM Class_Section__c
                ORDER BY Class__r.Name, Section__r.Name
            ];
            for (Class_Section__c cs : sections) {
                Map<String, Object> m = new Map<String, Object>();
                m.put('Id',           cs.Id);
                m.put('Name',         cs.Name);
                m.put('className',    cs.Class__r   != null ? cs.Class__r.Name   : '');
                m.put('sectionName',  cs.Section__r != null ? cs.Section__r.Name : '');
                m.put('academicYear', cs.Academic_Year__r != null ? cs.Academic_Year__r.Name : '');
                m.put('classId',      cs.Class__c);
                result.add(m);
            }
            return result;
        } catch (Exception e) {
            throw new AuraHandledException('Failed to load class sections: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getAllTeachers() {
        List<Map<String, Object>> result = new List<Map<String, Object>>();
        try {
            List<Account> teachers = [
                SELECT Id, Name FROM Account
                WHERE Type = 'Teacher' AND IsPersonAccount = true
                ORDER BY Name
            ];
            if (teachers.isEmpty()) {
                teachers = [SELECT Id, Name FROM Account WHERE Type = 'Teacher' ORDER BY Name LIMIT 200];
            }
            for (Account t : teachers) {
                result.add(new Map<String, Object>{ 'Id' => t.Id, 'Name' => t.Name });
            }
            return result;
        } catch (Exception e) {
            return result;
        }
    }

    @AuraEnabled
    public static Map<String, Object> getTimetableForClass(
        Id     classSectionId,
        Id     academicYearId,
        String startDate,
        String endDate
    ) {
        Map<String, Object> result = new Map<String, Object>();
        try {
            Date sDate = String.isNotBlank(startDate) ? Date.valueOf(startDate) : null;
            Date eDate = String.isNotBlank(endDate)   ? Date.valueOf(endDate)   : null;

            List<Period__c> periods;
            try {
                periods = [
                    SELECT Id, Day__c, Period_Number__c, Subjects__c, Subject__c,
                           Assigned_Teacher__c, Assigned_Teacher__r.Name,
                           Is_Leaser__c,
                           Substitute_Teacher__c, Substitute_Teacher__r.Name
                    FROM Period__c
                    WHERE Class_Section__c = :classSectionId
                      AND Academic_Year__c = :academicYearId
                      AND Start_Date__c   >= :sDate
                      AND End_Date__c     <= :eDate
                    ORDER BY Day__c, Period_Number__c
                ];
            } catch (Exception qEx) {
                periods = [
                    SELECT Id, Day__c, Period_Number__c, Subjects__c, Subject__c,
                           Assigned_Teacher__c, Assigned_Teacher__r.Name,
                           Is_Leaser__c
                    FROM Period__c
                    WHERE Class_Section__c = :classSectionId
                      AND Academic_Year__c = :academicYearId
                      AND Start_Date__c   >= :sDate
                      AND End_Date__c     <= :eDate
                    ORDER BY Day__c, Period_Number__c
                ];
            }

            Map<Id, Id>     regularTeacherById   = new Map<Id, Id>();
            Map<Id, String> regularTeacherByName = new Map<Id, String>();
            for (Teacher_Assignment__c ta : [
                SELECT Teacher__c, Teacher__r.Name, Subject__c
                FROM Teacher_Assignment__c
                WHERE Class_Section__c = :classSectionId
            ]) {
                if (ta.Subject__c != null) {
                    regularTeacherById.put(ta.Subject__c,   ta.Teacher__c);
                    regularTeacherByName.put(ta.Subject__c, ta.Teacher__r.Name);
                }
            }

            Map<String, Id> subjectNameToId = buildSubjectNameToIdMap();

            for (Period__c p : periods) {
                if (p.Day__c == null || p.Period_Number__c == null) continue;
                String key = p.Day__c + '_' + p.Period_Number__c;

                Id subjectId = null;
                if (p.Subjects__c != null) {
                    subjectId = p.Subjects__c;
                } else if (String.isNotBlank(p.Subject__c)) {
                    subjectId = subjectNameToId.get(p.Subject__c.toLowerCase());
                }

                Id     regularId   = subjectId != null ? regularTeacherById.get(subjectId)   : null;
                String regularName = subjectId != null ? regularTeacherByName.get(subjectId) : null;

                Boolean isLeaser = (p.Is_Leaser__c == true);
                Boolean isOnLeave = false;
                String  onLeaveTeacherName    = null;
                String  substituteTeacherIdStr = null;
                String  substituteTeacherName = null;

                Id subTeacherId = null;
                String subTeacherName = null;
                try {
                    subTeacherId = (Id) p.get('Substitute_Teacher__c');
                    if (subTeacherId != null) {
                        SObject subRec = p.getSObject('Substitute_Teacher__r');
                        subTeacherName = subRec != null ? (String) subRec.get('Name') : null;
                    }
                } catch (Exception fieldEx) {}

                if (isLeaser) {
                    isOnLeave          = true;
                    onLeaveTeacherName = regularName != null ? regularName
                                        : (p.Assigned_Teacher__r != null ? p.Assigned_Teacher__r.Name : 'On Leave');
                    if (subTeacherId != null) {
                        substituteTeacherIdStr = String.valueOf(subTeacherId);
                        substituteTeacherName  = subTeacherName;
                    } else if (p.Assigned_Teacher__c != null && regularId != null && p.Assigned_Teacher__c != regularId) {
                        substituteTeacherIdStr = String.valueOf(p.Assigned_Teacher__c);
                        substituteTeacherName  = p.Assigned_Teacher__r != null ? p.Assigned_Teacher__r.Name : null;
                    }
                } else if (subTeacherId != null) {
                    isOnLeave              = true;
                    onLeaveTeacherName     = p.Assigned_Teacher__r != null ? p.Assigned_Teacher__r.Name : regularName;
                    substituteTeacherIdStr = String.valueOf(subTeacherId);
                    substituteTeacherName  = subTeacherName;
                } else if (subjectId != null && p.Assigned_Teacher__c != null && regularId != null && p.Assigned_Teacher__c != regularId) {
                    isOnLeave              = true;
                    onLeaveTeacherName     = regularName;
                    substituteTeacherIdStr = String.valueOf(p.Assigned_Teacher__c);
                    substituteTeacherName  = p.Assigned_Teacher__r != null ? p.Assigned_Teacher__r.Name : null;
                }

                result.put(key, new Map<String, Object>{
                    'periodId'              => p.Id,
                    'subjectId'             => subjectId,
                    'teacherId'             => (isOnLeave && substituteTeacherIdStr != null)
                                               ? substituteTeacherIdStr
                                               : (p.Assigned_Teacher__c != null ? String.valueOf(p.Assigned_Teacher__c) : null),
                    'regularTeacherId'      => regularId != null ? String.valueOf(regularId) : null,
                    'isOnLeave'             => isOnLeave,
                    'onLeaveTeacherName'    => onLeaveTeacherName,
                    'substituteTeacherId'   => substituteTeacherIdStr,
                    'substituteTeacherName' => substituteTeacherName
                });
            }
            return result;

        } catch (Exception e) {
            System.debug('getTimetableForClass error: ' + e.getMessage());
            return result;
        }
    }

    @AuraEnabled
    public static void saveSubstituteForPeriod(String periodId, String substituteTeacherId) {
        if (String.isBlank(periodId)) throw new AuraHandledException('Period ID is required.');
        try {
            Period__c p = [SELECT Id, Assigned_Teacher__c, Is_Leaser__c FROM Period__c WHERE Id = :periodId LIMIT 1];
            if (String.isNotBlank(substituteTeacherId)) {
                try {
                    p.put('Substitute_Teacher__c', (Id) substituteTeacherId);
                } catch (Exception lookupEx) {
                    p.Assigned_Teacher__c = (Id) substituteTeacherId;
                }
                p.Is_Leaser__c = true;
            } else {
                try { p.put('Substitute_Teacher__c', null); } catch (Exception ex) {}
                p.Is_Leaser__c = false;
            }
            update p;
        } catch (AuraHandledException ah) {
            throw ah;
        } catch (Exception e) {
            throw new AuraHandledException('Failed to save substitute: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static Map<String, Object> saveTimetablePeriods(
        String periodsData,
        Id     classSectionId,
        Id     academicYearId,
        String startDate,
        String endDate,
        String frequency
    ) {
        Savepoint sp = Database.setSavepoint();
        try {
            if (String.isBlank(periodsData)) {
                throw new AuraHandledException('No period data provided.');
            }

            List<Object> rawList = (List<Object>) JSON.deserializeUntyped(periodsData);
            Date sDate = String.isNotBlank(startDate) ? Date.valueOf(startDate) : null;
            Date eDate = String.isNotBlank(endDate)   ? Date.valueOf(endDate)   : null;

            Class_Section__c csRec = [
                SELECT Id, Name, Class__c, Class__r.Name
                FROM Class_Section__c
                WHERE Id = :classSectionId LIMIT 1
            ];
            String className        = csRec.Class__r != null ? csRec.Class__r.Name : csRec.Name;
            String classSectionName = csRec.Name;

            List<Period__c> toDelete = [
                SELECT Id FROM Period__c
                WHERE Class_Section__c = :classSectionId
                  AND Academic_Year__c = :academicYearId
                  AND Start_Date__c    = :sDate
                  AND End_Date__c      = :eDate
            ];
            if (!toDelete.isEmpty()) delete toDelete;

            Set<Id> subjectIds = new Set<Id>();
            for (Object raw : rawList) {
                Map<String, Object> cell = (Map<String, Object>) raw;
                String sid = (String) cell.get('subjectId');
                if (String.isNotBlank(sid)) {
                    try { subjectIds.add((Id) sid); } catch (Exception ex) {}
                }
            }
            Map<Id, String> subjectNameMap = new Map<Id, String>();
            if (!subjectIds.isEmpty()) {
                for (Subject__c subj : [SELECT Id, Name FROM Subject__c WHERE Id IN :subjectIds]) {
                    subjectNameMap.put(subj.Id, subj.Name);
                }
            }

            List<Period__c> toInsert = new List<Period__c>();

            for (Object raw : rawList) {
                Map<String, Object> cell = (Map<String, Object>) raw;

                String  day          = (String) cell.get('day');
                Integer periodNum    = cell.get('periodNumber') != null
                                         ? Integer.valueOf(String.valueOf(cell.get('periodNumber')))
                                         : null;
                String  subjectId    = (String) cell.get('subjectId');
                String  teacherId    = (String) cell.get('teacherId');
                String  startTimeStr = (String) cell.get('startTime');
                String  endTimeStr   = (String) cell.get('endTime');

                if (day == null || periodNum == null) continue;

                String subjectName = null;
                if (String.isNotBlank(subjectId)) {
                    try { subjectName = subjectNameMap.get((Id) subjectId); } catch (Exception ex) {}
                }

                String periodName = classSectionName + ' - ' + day + ' - P' + periodNum
                                    + (subjectName != null ? ' - ' + subjectName : '');

                Period__c p = new Period__c();
                p.Name             = periodName.left(80);
                p.Day__c           = day;
                p.Period_Number__c = String.valueOf(periodNum);
                p.Start_Date__c    = sDate;
                p.End_Date__c      = eDate;
                p.Frequency__c     = frequency;
                p.Class_Section__c = classSectionId;
                p.Academic_Year__c = academicYearId;
                p.Class__c         = className;

                if (String.isNotBlank(subjectId)) {
                    try { p.Subjects__c = (Id) subjectId; } catch (Exception ex) {}
                }

                if (String.isNotBlank(teacherId)) {
                    try { p.Assigned_Teacher__c = (Id) teacherId; } catch (Exception ex) {}
                }

                if (String.isNotBlank(startTimeStr)) {
                    try { p.Start_Time__c = parseTimeString(startTimeStr); } catch (Exception ex) {}
                }
                if (String.isNotBlank(endTimeStr)) {
                    try { p.End_Time__c = parseTimeString(endTimeStr); } catch (Exception ex) {}
                }

                toInsert.add(p);
            }

            if (!toInsert.isEmpty()) insert toInsert;

            return new Map<String, Object>{
                'savedCount' => toInsert.size(),
                'success'    => true
            };

        } catch (Exception e) {
            Database.rollback(sp);
            throw new AuraHandledException('Failed to save timetable: ' + e.getMessage());
        }
    }

    private static Time parseTimeString(String timeStr) {
        timeStr = timeStr.trim().toUpperCase();
        Boolean isPM = timeStr.endsWith('PM');
        timeStr = timeStr.replace('AM', '').replace('PM', '').trim();
        List<String> parts = timeStr.split(':');
        Integer hours   = Integer.valueOf(parts[0].trim());
        Integer minutes = Integer.valueOf(parts[1].trim());
        if (isPM  && hours != 12) hours += 12;
        if (!isPM && hours == 12) hours  = 0;
        return Time.newInstance(hours, minutes, 0, 0);
    }

    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getTeachersForSubjectInClass(
        Id subjectId,
        Id classSectionId
    ) {
        List<Map<String, Object>> result = new List<Map<String, Object>>();
        try {
            Set<Id> teacherIds = new Set<Id>();
            for (Teacher_Skill__c sk : [
                SELECT Teacher__c FROM Teacher_Skill__c WHERE Subject__c = :subjectId
            ]) {
                teacherIds.add(sk.Teacher__c);
            }

            if (!teacherIds.isEmpty()) {
                for (Account t : [SELECT Id, Name FROM Account WHERE Id IN :teacherIds ORDER BY Name]) {
                    result.add(new Map<String, Object>{ 'Id' => t.Id, 'Name' => t.Name });
                }
                return result;
            }

            for (Account t : [
                SELECT Id, Name FROM Account
                WHERE Type = 'Teacher' AND IsPersonAccount = true
                ORDER BY Name LIMIT 200
            ]) {
                result.add(new Map<String, Object>{ 'Id' => t.Id, 'Name' => t.Name });
            }
            return result;

        } catch (Exception e) {
            System.debug('getTeachersForSubjectInClass error: ' + e.getMessage());
            return result;
        }
    }

    @AuraEnabled(cacheable=false)
    public static List<Map<String, Object>> getPeriodsForTeacherWithGaps(String teacherId) {
        if (String.isBlank(teacherId)) return new List<Map<String, Object>>();

        List<Map<String, Object>> actualPeriods = getPeriodsForTeacher(teacherId);

        Integer totalPeriods = 8;
        try {
            totalPeriods = [SELECT COUNT() FROM Period_Timing__c WHERE Is_Active__c = true];
            if (totalPeriods == 0) totalPeriods = 8;
        } catch (Exception e) {
            totalPeriods = 8;
        }

        Set<String> existingKeys = new Set<String>();
        Map<String, String> daySet = new Map<String, String>();
        for (Map<String, Object> p : actualPeriods) {
            String day = (String) p.get('day');
            String num = String.valueOf(p.get('periodNumber'));
            if (day != null && num != null) {
                existingKeys.add(day + '_' + num);
                daySet.put(day, day);
            }
        }

        List<String> schoolDays = new List<String>{
            'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
        };

        for (String day : schoolDays) {
            if (!daySet.containsKey(day)) continue;
            for (Integer i = 1; i <= totalPeriods; i++) {
                String key = day + '_' + i;
                if (!existingKeys.contains(key)) {
                    actualPeriods.add(new Map<String, Object>{
                        'periodId'              => 'free_' + day + '_' + i,
                        'day'                   => day,
                        'periodNumber'          => Decimal.valueOf(i),
                        'classSectionId'        => '',
                        'className'             => '',
                        'academicYearId'        => '',
                        'academicYear'          => '',
                        'startDate'             => '',
                        'endDate'               => '',
                        'frequency'             => '',
                        'startTime'             => '',
                        'endTime'               => '',
                        'subjectId'             => null,
                        'subjectName'           => '',
                        'isLeaser'              => false,
                        'isFreePeriod'          => true,
                        'substituteTeacherId'   => null,
                        'substituteTeacherName' => null
                    });
                }
            }
        }

        return actualPeriods;
    }

    @AuraEnabled(cacheable=true)
    public static List<Teacher_Skill__c> getTeacherSkills(Id teacherId) {
        if (teacherId == null) {
            return new List<Teacher_Skill__c>();
        }
        return [
            SELECT Id, Subject__c, Subject__r.Name, Skill_Level__c
            FROM Teacher_Skill__c
            WHERE Teacher__c = :teacherId
            ORDER BY Skill_Level__c ASC, Subject__r.Name ASC
            LIMIT 50
        ];
    }
}