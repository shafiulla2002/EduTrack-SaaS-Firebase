public with sharing class SchoolStaffController {

   
    public class StaffWrapper {
        @AuraEnabled public String  id;
        @AuraEnabled public String  EmployeeId;
        @AuraEnabled public String  FirstName;
        @AuraEnabled public String  LastName;
        @AuraEnabled public String  Name;
        @AuraEnabled public String  Gender;
        @AuraEnabled public String  Dob;
        @AuraEnabled public String  Email;
        @AuraEnabled public String  Phone;
        @AuraEnabled public String  Address;
        @AuraEnabled public String  Designation;
        @AuraEnabled public String  Department;
        @AuraEnabled public String  StaffType;
        @AuraEnabled public String  Subject;
        @AuraEnabled public String  Qualification;
        @AuraEnabled public String  JoiningDate;
        @AuraEnabled public String  Status;
        @AuraEnabled public Decimal BasicSalary;
        @AuraEnabled public Decimal Hra;
        @AuraEnabled public Decimal Da;
        @AuraEnabled public Decimal Pf;
        @AuraEnabled public String  AccountNumber;
        @AuraEnabled public String  Ifsc;
        @AuraEnabled public String  SalaryStatus;
        @AuraEnabled public String  PhotoUrl;
        @AuraEnabled public List<Map<String,Object>> SubjectSkills;
    }

    public class PayrollWrapper {
        @AuraEnabled public String  id;
        @AuraEnabled public String  staffId;
        @AuraEnabled public String  staffName;
        @AuraEnabled public String  designation;
        @AuraEnabled public String  staffType;
        @AuraEnabled public String  employeeId;
        @AuraEnabled public Decimal basicSalary;
        @AuraEnabled public Decimal hra;
        @AuraEnabled public Decimal da;
        @AuraEnabled public Decimal pf;
        @AuraEnabled public Decimal allowances;
        @AuraEnabled public Decimal deductions;
        @AuraEnabled public Decimal netSalary;
        @AuraEnabled public String  salaryStatus;
        @AuraEnabled public String  invoiceMonth;
        @AuraEnabled public String  paidDate;
    }

    public class PayslipWrapper {
        @AuraEnabled public String  invoiceId;
        @AuraEnabled public String  staffId;
        @AuraEnabled public String  staffName;
        @AuraEnabled public String  employeeId;
        @AuraEnabled public String  designation;
        @AuraEnabled public String  staffType;
        @AuraEnabled public String  invoiceMonth;
        @AuraEnabled public String  paidDate;
        @AuraEnabled public Decimal basicSalary;
        @AuraEnabled public Decimal hra;
        @AuraEnabled public Decimal da;
        @AuraEnabled public Decimal pf;
        @AuraEnabled public Decimal allowances;
        @AuraEnabled public Decimal deductions;
        @AuraEnabled public Decimal netSalary;
        @AuraEnabled public String  bankAccount;
        @AuraEnabled public String  ifscCode;
    }

   
    @AuraEnabled(cacheable=false)
    public static Map<String, Object> getStaffDetail(String staffId) {
        Map<String, Object> result = new Map<String, Object>();
        
        if (String.isBlank(staffId)) {
            result.put('skills', new List<Map<String, Object>>());
            result.put('invoices', new List<Map<String, Object>>());
            result.put('periods', new List<Map<String, Object>>());
            result.put('cases', new List<Map<String, Object>>());
            return result;
        }

        // 1️⃣ Subject Skills
        List<Map<String, Object>> skills = new List<Map<String, Object>>();
        try {
            for (Teacher_Skill__c sk : (List<Teacher_Skill__c>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Subject__c, Subject__r.Name, Skill_Level__c, Years_of_Experience__c FROM Teacher_Skill__c WHERE Teacher__c = :staffId ORDER BY Subject__r.Name ASC]).getRecords()) {
                skills.add(new Map<String, Object>{
                    'id'                => sk.Id,
                    'subjectId'         => sk.Subject__c,
                    'subjectName'       => sk.Subject__r != null ? sk.Subject__r.Name : '',
                    'skillLevel'        => sk.Skill_Level__c,
                    'yearsOfExperience' => sk.Years_of_Experience__c
                });
            }
        } catch (Exception e) {
            System.debug('❌ Skills Error: ' + e.getMessage());
        }
        result.put('skills', skills);

        // 2️⃣ Invoices
        List<Map<String, Object>> invoices = new List<Map<String, Object>>();
        try {
            for (Invoice__c inv : [SELECT Id, Invoice_Month__c, Status__c, Total_Amount__c,
                       Invoice_Date__c, Due_Date__c
                FROM Invoice__c
                WHERE Account__c = :staffId
                AND Invoice_Type__c = 'Salary'
                WITH SECURITY_ENFORCED
                 ORDER BY Invoice_Date__c DESC LIMIT 12]) {
                invoices.add(new Map<String, Object>{
                    'id'       => inv.Id,
                    'month'    => inv.Invoice_Month__c,
                    'status'   => inv.Status__c == 'Paid' ? 'Paid' : 'Pending',
                    'amount'   => inv.Total_Amount__c != null ? inv.Total_Amount__c : 0,
                    'paidDate' => inv.Invoice_Date__c != null ? inv.Invoice_Date__c.format() : '',
                    'dueDate'  => inv.Due_Date__c     != null ? inv.Due_Date__c.format()     : ''
                });
            }
        } catch (Exception e) {
            System.debug('❌ Invoices Error: ' + e.getMessage());
        }
        result.put('invoices', invoices);

        // 3️⃣ Timetable periods
        List<Map<String, Object>> periods = new List<Map<String, Object>>();
        try {
            for (Period__c p : [SELECT Id, Day__c, Period_Number__c,
                       Subjects__c, Subjects__r.Name,
                       Class_Section__c, Class_Section__r.Name,
                       Start_Time__c, End_Time__c
                FROM Period__c
                WHERE Assigned_Teacher__c = :staffId
                WITH SECURITY_ENFORCED
                 ORDER BY Day__c, Period_Number__c]) {
                String startTime = p.Start_Time__c != null
                    ? DateTime.newInstance(Date.today(), p.Start_Time__c).format('h:mm a') : '';
                String endTime = p.End_Time__c != null
                    ? DateTime.newInstance(Date.today(), p.End_Time__c).format('h:mm a') : '';
                periods.add(new Map<String, Object>{
                    'periodId'     => p.Id,
                    'day'          => p.Day__c,
                    'periodNumber' => p.Period_Number__c,
                    'subjectName'  => p.Subjects__r      != null ? p.Subjects__r.Name        : '-',
                    'className'    => p.Class_Section__r != null ? p.Class_Section__r.Name   : '-',
                    'startTime'    => startTime,
                    'endTime'      => endTime,
                    'timeLabel'    => (String.isNotBlank(startTime) && String.isNotBlank(endTime))
                                      ? startTime + ' – ' + endTime : ''
                });
            }
        } catch (Exception e) {
            System.debug('❌ Periods Error: ' + e.getMessage());
        }
        result.put('periods', periods);

        // 4️⃣ Cases - Multi-strategy approach
        List<Map<String, Object>> cases = new List<Map<String, Object>>();
        try {
            Set<Id> foundIds = new Set<Id>();
            List<Case> caseList = new List<Case>();

            // Strategy 1: Submitted_By__c (teacher lookup on Case)
            try {
                List<Case> s1 = [SELECT Id, CaseNumber, Subject, Description, Status, Priority, Type, CreatedDate,
                           AccountId, Account.Name, Account.Class__c,
                           ContactId, Contact.Name, Contact.AccountId
                    FROM Case
                     WHERE Submitted_By__c = :staffId
                     WITH SECURITY_ENFORCED
                     ORDER BY CreatedDate DESC LIMIT 50];
                for (Case c : s1) {
                    if (!foundIds.contains(c.Id)) { caseList.add(c); foundIds.add(c.Id); }
                }
            } catch (Exception ex1) {
                System.debug('Strategy 1 failed: ' + ex1.getMessage());
            }

            // Strategy 2: AccountId = staffId
            try {
                List<Case> s2 = [SELECT Id, CaseNumber, Subject, Description, Status, Priority, Type, CreatedDate,
                           AccountId, Account.Name, Account.Class__c,
                           ContactId, Contact.Name, Contact.AccountId
                    FROM Case
                     WHERE AccountId = :staffId
                     WITH SECURITY_ENFORCED
                     ORDER BY CreatedDate DESC LIMIT 50];
                for (Case c : s2) {
                    if (!foundIds.contains(c.Id)) { caseList.add(c); foundIds.add(c.Id); }
                }
            } catch (Exception ex2) {
                System.debug('Strategy 2 failed: ' + ex2.getMessage());
            }

            // Strategy 3: PersonContactId
            try {
                Account staffAcc = [SELECT Id, PersonContactId FROM Account WHERE Id = :staffId WITH SECURITY_ENFORCED LIMIT 1];
                if (staffAcc.PersonContactId != null) {
                    List<Case> s3 = [SELECT Id, CaseNumber, Subject, Description, Status, Priority, Type, CreatedDate,
                               AccountId, Account.Name, Account.Class__c,
                               ContactId, Contact.Name, Contact.AccountId
                        FROM Case
                         WHERE ContactId = :staffAcc.PersonContactId
                         WITH SECURITY_ENFORCED
                         ORDER BY CreatedDate DESC LIMIT 50];
                    for (Case c : s3) {
                        if (!foundIds.contains(c.Id)) { caseList.add(c); foundIds.add(c.Id); }
                    }
                }
            } catch (Exception ex3) {
                System.debug('Strategy 3 failed: ' + ex3.getMessage());
            }

            // Map to UI objects
            for (Case c : caseList) {
                String caseType = 'Complaint';
                if (c.Type != null) {
                    String t = c.Type.toLowerCase();
                    if (t.contains('praise') || t.contains('compliment') ||
                        t.contains('appreciation') || t.contains('positive')) {
                        caseType = 'Praise';
                    }
                }

                String className = '';
                Object clsVal = NamespaceUtils.getValue(c.Account, 'Class__c');
                if (c.Account != null && clsVal != null) {
                    className = String.valueOf(clsVal);
                }

                String studentName = '';
                if (c.Account != null && String.isNotBlank(c.Account.Name)) {
                    studentName = c.Account.Name;
                } else if (c.Contact != null && String.isNotBlank(c.Contact.Name)) {
                    studentName = c.Contact.Name;
                }

                cases.add(new Map<String, Object>{
                    'id'          => c.Id,
                    'caseNumber'  => c.CaseNumber,
                    'subject'     => String.isNotBlank(c.Subject) ? c.Subject : '(No Subject)',
                    'description' => c.Description,
                    'status'      => String.isNotBlank(c.Status) ? c.Status : 'New',
                    'priority'    => c.Priority,
                    'type'        => caseType,
                    'createdDate' => c.CreatedDate != null ? c.CreatedDate.format('dd/MM/yyyy') : '',
                    'studentName' => studentName,
                    'className'   => className
                });
            }

        } catch (Exception e) {
            System.debug('❌ Cases Error: ' + e.getMessage());
        }

        result.put('cases', cases);
        return result;
    }

   
    @AuraEnabled
    public static String uploadStaffPhoto(String staffId, String base64Data, String fileName) {
        try {
            if (String.isBlank(staffId))    throw new AuraHandledException('Staff ID is required.');
            if (String.isBlank(base64Data)) throw new AuraHandledException('Image data is required.');
            if (String.isBlank(fileName))   fileName = 'staff_photo.jpg';
            
            String cleanBase64 = base64Data.contains(',') ? base64Data.substringAfter(',') : base64Data;
            
            // Delete old photos
            List<ContentDocumentLink> oldLinks = [SELECT ContentDocumentId FROM ContentDocumentLink WHERE LinkedEntityId = :staffId WITH SECURITY_ENFORCED];
            if (!oldLinks.isEmpty()) {
                Set<Id> docIds = new Set<Id>();
                for (ContentDocumentLink cdl : oldLinks) docIds.add(cdl.ContentDocumentId);
                List<ContentVersion> oldPhotos = [SELECT ContentDocumentId FROM ContentVersion WHERE ContentDocumentId IN :docIds AND Title LIKE 'staff_photo_%' AND IsLatest = true WITH SECURITY_ENFORCED];
                if (!oldPhotos.isEmpty()) {
                    Set<Id> delDocIds = new Set<Id>();
                    for (ContentVersion cv : oldPhotos) delDocIds.add(cv.ContentDocumentId);
                    if (Schema.sObjectType.ContentDocument.isDeletable()) {
                        delete [SELECT Id FROM ContentDocument WHERE Id IN :delDocIds WITH SECURITY_ENFORCED];
                    }
                }
            }
            
            // Upload new photo
            ContentVersion cv = new ContentVersion();
            cv.Title = 'staff_photo_' + staffId;
            cv.PathOnClient = fileName;
            cv.VersionData = EncodingUtil.base64Decode(cleanBase64);
            cv.IsMajorVersion = true;
            if (!Schema.sObjectType.ContentVersion.isCreateable()) {
                throw new AuraHandledException('Insufficient permissions to upload photos.');
            }
            insert cv;
            
            Id contentDocId = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cv.Id WITH SECURITY_ENFORCED LIMIT 1].ContentDocumentId;
            ContentDocumentLink cdl = new ContentDocumentLink();
            cdl.ContentDocumentId = contentDocId;
            cdl.LinkedEntityId = staffId;
            cdl.ShareType = 'V';
            cdl.Visibility = 'AllUsers';
            if (!Schema.sObjectType.ContentDocumentLink.isCreateable()) {
                throw new AuraHandledException('Insufficient permissions to link photos.');
            }
            insert cdl;
            
            return cv.Id;
        } catch (AuraHandledException ahe) { throw ahe; }
        catch (Exception e) { throw new AuraHandledException('Photo upload failed: ' + e.getMessage()); }
    }

   
    private static Map<Id, String> getPhotoUrlMap(Set<Id> accountIds) {
        Map<Id, String> result = new Map<Id, String>();
        if (accountIds == null || accountIds.isEmpty()) return result;
        
        Map<Id, Set<Id>> accToDocIds = new Map<Id, Set<Id>>();
        for (ContentDocumentLink cdl : [SELECT LinkedEntityId, ContentDocumentId FROM ContentDocumentLink WHERE LinkedEntityId IN :accountIds WITH SECURITY_ENFORCED]) {
            Id leid = cdl.LinkedEntityId; Id dcid = cdl.ContentDocumentId; if(leid != null && dcid != null) { if(!accToDocIds.containsKey(leid)) accToDocIds.put(leid, new Set<Id>()); accToDocIds.get(leid).add(dcid); }
        }
        
        if (accToDocIds.isEmpty()) return result;
        
        Set<Id> allDocIds = new Set<Id>();
        for (Set<Id> ds : accToDocIds.values()) allDocIds.addAll(ds);
        
        Map<Id, String> docToUrl = new Map<Id, String>();
        for (ContentVersion cv : [SELECT Id, ContentDocumentId FROM ContentVersion WHERE ContentDocumentId IN :allDocIds AND Title LIKE 'staff_photo_%' AND IsLatest = true WITH SECURITY_ENFORCED]) {
            if (!docToUrl.containsKey(cv.ContentDocumentId))
                docToUrl.put(cv.ContentDocumentId, '/sfc/servlet.shepherd/version/download/' + cv.Id);
        }
        
        for (Id accId : accToDocIds.keySet()) {
            for (Id docId : accToDocIds.get(accId)) {
                if (docToUrl.containsKey(docId)) { result.put(accId, docToUrl.get(docId)); break; }
            }
        }
        return result;
    }

  
    @AuraEnabled
    public static List<StaffWrapper> getAllStaff() {
        List<Account> allAccounts = (List<Account>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, FirstName, LastName, Name, PersonEmail, PersonMobilePhone,
                   PersonBirthdate, PersonMailingStreet, Type, Employee_ID__c,
                   PersonGenderIdentity, Designation__c, PersonDepartment,
                   Joining_Date__c, Subject_Taught__c, Qualification__c,
                   Basic_Salary__c, HRA__c, DA__c, PF_Deduction__c,
                   Bank_Account_Number__c, IFSC_Code__c, Staff_Status__c
            FROM Account
            WHERE IsPersonAccount = true 
            ORDER BY CreatedDate DESC]).getRecords();
        
        List<Account> accounts = new List<Account>();
        for (Account acc : allAccounts) {
            String accType = getSObjectField(acc, 'Type');
            if (accType == 'Teacher' || accType == 'Non Teaching Staff') {
                accounts.add(acc);
            }
        }
        
        Set<Id> accountIds = new Map<Id, Account>(accounts).keySet();
        Map<Id, String> salaryStatusMap = getSalaryStatusMap(accountIds);
        Map<Id, String> photoUrlMap     = getPhotoUrlMap(accountIds);
        Map<Id, List<Map<String,Object>>> skillsMap = new Map<Id, List<Map<String,Object>>>();
        
        try {
            for (Teacher_Skill__c sk : [SELECT Teacher__c, Subject__c, Subject__r.Name, Skill_Level__c, Years_of_Experience__c FROM Teacher_Skill__c WHERE Teacher__c IN :accountIds WITH SECURITY_ENFORCED ORDER BY Subject__r.Name ASC]) {
                if (!skillsMap.containsKey(sk.Teacher__c)) skillsMap.put(sk.Teacher__c, new List<Map<String,Object>>());
                skillsMap.get(sk.Teacher__c).add(new Map<String,Object>{
                    'id' => sk.Id, 'subjectId' => sk.Subject__c,
                    'subjectName' => sk.Subject__r != null ? sk.Subject__r.Name : '',
                    'skillLevel' => sk.Skill_Level__c, 'yearsOfExperience' => sk.Years_of_Experience__c
                });
            }
        } catch (Exception e) {
            System.debug('Skills load error: ' + e.getMessage());
        }
        
        List<StaffWrapper> result = new List<StaffWrapper>();
        for (Account acc : accounts) {
            StaffWrapper w  = toWrapper(acc, salaryStatusMap.get(acc.Id));
            w.PhotoUrl      = photoUrlMap.get(acc.Id);
            w.SubjectSkills = skillsMap.containsKey(acc.Id) ? skillsMap.get(acc.Id) : new List<Map<String,Object>>();
            result.add(w);
        }
        return result;
    }

  
    @AuraEnabled(cacheable=false)
    public static List<PayrollWrapper> getPayrollRecords(String invoiceMonth) {
        List<Account> allAccounts = (List<Account>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Name, FirstName, LastName, Type, Employee_ID__c, Designation__c,
                   Basic_Salary__c, HRA__c, DA__c, PF_Deduction__c
            FROM Account WHERE IsPersonAccount = true ORDER BY Name ASC]).getRecords();
        List<Account> accounts = new List<Account>();
        for (Account acc : allAccounts) {
            String accType = getSObjectField(acc, 'Type');
            if (accType == 'Teacher' || accType == 'Non Teaching Staff') {
                accounts.add(acc);
            }
        }
        
        Map<Id, Invoice__c> invoiceByAccount = new Map<Id, Invoice__c>();
        for (Invoice__c inv : (List<Invoice__c>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Account__c, Status__c, Invoice_Month__c, Invoice_Date__c, CreatedDate FROM Invoice__c WHERE Invoice_Type__c = 'Salary' AND Invoice_Month__c = :invoiceMonth AND Account__c IN :new Map<Id, Account>(accounts).keySet()]).getRecords()) { 
            Id accId = (Id)NamespaceUtils.getValue(inv, 'Account__c');
            if (accId != null) invoiceByAccount.put(accId, inv); 
        }
        
        List<PayrollWrapper> result = new List<PayrollWrapper>();
        for (Account acc : accounts) {
            Invoice__c inv = invoiceByAccount.get(acc.Id);
            Decimal basic = getSObjectDecimal(acc, 'Basic_Salary__c');
            Decimal hra   = getSObjectDecimal(acc, 'HRA__c');
            Decimal da    = getSObjectDecimal(acc, 'DA__c');
            Decimal pf    = getSObjectDecimal(acc, 'PF_Deduction__c');
            
            PayrollWrapper pw = new PayrollWrapper();
            pw.staffId = acc.Id; pw.staffName = acc.Name; pw.designation = getSObjectField(acc, 'Designation__c');
            pw.staffType = getSObjectField(acc, 'Type') == 'Teacher' ? 'Teaching' : 'Non-Teaching';
            pw.employeeId = getSObjectField(acc, 'Employee_ID__c'); pw.basicSalary = basic;
            pw.hra = hra; pw.da = da; pw.pf = pf;
            pw.allowances = hra + da; pw.deductions = pf; pw.netSalary = basic + hra + da - pf;
            pw.invoiceMonth = invoiceMonth;
            
            if (inv != null) {
                pw.id = inv.Id; String s = (String)getSafe(inv, 'Status__c'); pw.salaryStatus = (s == 'Paid') ? 'Paid' : 'Pending';
                Date d = (Date)getSafe(inv, 'Invoice_Date__c'); pw.paidDate = (d != null) ? d.format() : String.valueOf(Date.today());
            } else { pw.id = null; pw.salaryStatus = 'Pending'; pw.paidDate = ''; }
            result.add(pw);
        }
        return result;
    }

  
    @AuraEnabled(cacheable=false)
    public static PayslipWrapper getPayslipData(String staffId, String invoiceMonth) {
        if (String.isBlank(staffId) || String.isBlank(invoiceMonth))
            throw new AuraHandledException('Staff ID and Invoice Month are required.');
        
        List<Account> accs = (List<Account>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Name, Employee_ID__c, Designation__c, Type, Basic_Salary__c, HRA__c, DA__c, PF_Deduction__c, Bank_Account_Number__c, IFSC_Code__c FROM Account WHERE Id = :staffId LIMIT 1]).getRecords();
        if (accs.isEmpty()) throw new AuraHandledException('Staff member not found.');
        Account acc = accs[0];
        List<Invoice__c> invList = [SELECT Id, Status__c, Invoice_Date__c, Total_Amount__c FROM Invoice__c WHERE Account__c = :staffId AND Invoice_Type__c = 'Salary' AND Invoice_Month__c = :invoiceMonth AND Status__c = 'Paid' WITH SECURITY_ENFORCED ORDER BY Invoice_Date__c DESC LIMIT 1];
        
        Decimal basic = acc.Basic_Salary__c != null ? acc.Basic_Salary__c : 0;
        Decimal hra   = acc.HRA__c          != null ? acc.HRA__c          : 0;
        Decimal da    = acc.DA__c           != null ? acc.DA__c           : 0;
        Decimal pf    = acc.PF_Deduction__c != null ? acc.PF_Deduction__c : 0;
        
        PayslipWrapper ps = new PayslipWrapper();
        ps.staffId = acc.Id; ps.staffName = acc.Name; ps.employeeId = getSObjectField(acc, 'Employee_ID__c');
        ps.designation = getSObjectField(acc, 'Designation__c'); ps.staffType = getSObjectField(acc, 'Type') == 'Teacher' ? 'Teaching' : 'Non-Teaching';
        ps.invoiceMonth = invoiceMonth; ps.basicSalary = basic; ps.hra = hra; ps.da = da; ps.pf = pf;
        ps.allowances = basic + hra + da; ps.deductions = pf; ps.netSalary = basic + hra + da - pf;
        ps.bankAccount = getSObjectField(acc, 'Bank_Account_Number__c'); ps.ifscCode = getSObjectField(acc, 'IFSC_Code__c');
        
        if (!invList.isEmpty()) {
            ps.invoiceId = invList[0].Id;
            Date pd = (Date)getSafe(invList[0], 'Invoice_Date__c'); ps.paidDate = (pd != null) ? pd.format() : String.valueOf(Date.today());
        } else { ps.invoiceId = '-'; ps.paidDate = String.valueOf(Date.today()); }
        
        return ps;
    }

    @AuraEnabled
    public static String upsertStaff(String jsonData, String skillsJson) {
        if (String.isBlank(jsonData)) throw new AuraHandledException('No staff data received.');
        
        StaffWrapper data;
        try { data = (StaffWrapper) JSON.deserialize(jsonData, StaffWrapper.class); }
        catch (Exception e) { throw new AuraHandledException('Failed to parse staff data: ' + e.getMessage()); }
        
        if (data == null) throw new AuraHandledException('Parsed staff data is null.');
        
        String firstName = safeStr(data.FirstName); 
        String lastName = safeStr(data.LastName);
        String email = safeStr(data.Email); 
        String phone = safeStr(data.Phone);
        
        if (String.isBlank(firstName)) throw new AuraHandledException('First Name is required.');
        if (String.isBlank(lastName))  throw new AuraHandledException('Last Name is required.');
        if (String.isBlank(email))     throw new AuraHandledException('Email is required.');
        if (String.isBlank(phone))     throw new AuraHandledException('Phone is required.');
        if (data.BasicSalary == null || data.BasicSalary <= 0)
            throw new AuraHandledException('Please enter a valid Basic Salary.');
        
        Savepoint sp = Database.setSavepoint();
        try {
            Account acc;
            if (String.isNotBlank(data.id)) { acc = new Account(Id = data.id); }
            else { acc = new Account(); Id rtId = getPersonAccountRecordTypeId(); if (rtId != null) acc.RecordTypeId = rtId; }
            
            acc.FirstName = firstName; 
            acc.LastName = lastName; 
            acc.PersonEmail = email;
            acc.PersonMobilePhone      = String.isNotBlank(phone) ? phone : null;
            acc.PersonMailingStreet    = String.isNotBlank(safeStr(data.Address))        ? safeStr(data.Address)        : null;
            acc.Type                   = (safeStr(data.StaffType) == 'Teaching')         ? 'Teacher'                    : 'Non Teaching Staff';
            acc.PersonGenderIdentity   = String.isNotBlank(safeStr(data.Gender))         ? safeStr(data.Gender)         : null;
            acc.PersonDepartment       = String.isNotBlank(safeStr(data.Department))     ? safeStr(data.Department)     : null;
            acc.Designation__c         = String.isNotBlank(safeStr(data.Designation))    ? safeStr(data.Designation)    : null;
            acc.Qualification__c       = String.isNotBlank(safeStr(data.Qualification))  ? safeStr(data.Qualification)  : null;
            acc.Basic_Salary__c        = data.BasicSalary != null ? data.BasicSalary : 0;
            acc.HRA__c                 = data.Hra         != null ? data.Hra         : 0;
            acc.DA__c                  = data.Da          != null ? data.Da          : 0;
            acc.PF_Deduction__c        = data.Pf          != null ? data.Pf          : 0;
            acc.Bank_Account_Number__c = String.isNotBlank(safeStr(data.AccountNumber))  ? safeStr(data.AccountNumber)  : null;
            acc.IFSC_Code__c           = String.isNotBlank(safeStr(data.Ifsc))           ? safeStr(data.Ifsc)           : null;
            acc.Staff_Status__c        = String.isNotBlank(safeStr(data.Status))         ? safeStr(data.Status)         : 'Active';
            
            if (String.isNotBlank(safeStr(data.Dob)))         { try { acc.PersonBirthdate = Date.valueOf(data.Dob);          } catch (Exception ex) {} }
            if (String.isNotBlank(safeStr(data.JoiningDate))) { try { acc.Joining_Date__c = Date.valueOf(data.JoiningDate);  } catch (Exception ex) {} }
            
            if (String.isNotBlank(data.id)) {
                if (!Schema.sObjectType.Account.isUpdateable()) {
                    throw new AuraHandledException('Insufficient permissions to update staff.');
                }
                SObjectAccessDecision decision = Security.stripInaccessible(AccessType.UPDATABLE, new List<Account>{acc});
                update decision.getRecords();
            }
            else {
                if (!Schema.sObjectType.Account.isCreateable()) {
                    throw new AuraHandledException('Insufficient permissions to create staff.');
                }
                SObjectAccessDecision decision = Security.stripInaccessible(AccessType.CREATABLE, new List<Account>{acc});
                insert decision.getRecords();
                acc.Id = decision.getRecords()[0].Id;
                if (!Schema.sObjectType.Account.isUpdateable()) {
                    throw new AuraHandledException('Insufficient permissions to update staff employee ID.');
                }
                Account updateAcc = new Account(Id = acc.Id, Employee_ID__c = generateEmployeeId(acc.Id, safeStr(data.StaffType)));
                update updateAcc;
            }
            
            // Skills
            if (String.isNotBlank(skillsJson)) {
                List<Object> skillsList;
                try { skillsList = (List<Object>) JSON.deserializeUntyped(skillsJson); } catch (Exception ex) { skillsList = new List<Object>(); }
                
                List<Teacher_Skill__c> oldSkills = [SELECT Id FROM Teacher_Skill__c WHERE Teacher__c = :acc.Id WITH SECURITY_ENFORCED];
                if (!oldSkills.isEmpty()) {
                    if (!Schema.sObjectType.Teacher_Skill__c.isDeletable()) {
                        throw new AuraHandledException('Insufficient permissions to delete staff skills.');
                    }
                    delete oldSkills;
                }
                
                List<Teacher_Skill__c> newSkills = new List<Teacher_Skill__c>();
                String fullName = firstName + ' ' + lastName;
                
                for (Object skObj : skillsList) {
                    Map<String, Object> sk = (Map<String, Object>) skObj;
                    String subjectId  = sk.get('subjectId')  != null ? String.valueOf(sk.get('subjectId'))  : '';
                    String skillLevel = sk.get('skillLevel') != null ? String.valueOf(sk.get('skillLevel')) : '';
                    
                    if (String.isBlank(subjectId) || String.isBlank(skillLevel)) continue;
                    
                    String subjectName = sk.get('subjectName') != null ? String.valueOf(sk.get('subjectName')) : subjectId;
                    Teacher_Skill__c ts = new Teacher_Skill__c(Name = fullName + ' - ' + subjectName, Teacher__c = acc.Id, Subject__c = subjectId, Skill_Level__c = skillLevel);
                    
                    if (sk.get('yearsOfExperience') != null) { 
                        try { ts.Years_of_Experience__c = Decimal.valueOf(String.valueOf(sk.get('yearsOfExperience'))); } 
                        catch (Exception ex) {} 
                    }
                    newSkills.add(ts);
                }
                if (!newSkills.isEmpty()) {
                    if (!Schema.sObjectType.Teacher_Skill__c.isCreateable()) {
                        throw new AuraHandledException('Insufficient permissions to create staff skills.');
                    }
                    SObjectAccessDecision decision = Security.stripInaccessible(AccessType.CREATABLE, newSkills);
                    insert decision.getRecords();
                }
            }
            return acc.Id;
        } catch (AuraHandledException ahe) { Database.rollback(sp); throw ahe; }
        catch (DmlException dml) {
            Database.rollback(sp);
            String msg = '';
            for (Integer i = 0; i < dml.getNumDml(); i++) msg += dml.getDmlFieldNames(i) + ': ' + dml.getDmlMessage(i) + '; ';
            throw new AuraHandledException('Save failed: ' + msg);
        } catch (Exception e) { Database.rollback(sp); throw new AuraHandledException('Save failed: ' + e.getMessage()); }
    }

   
    @AuraEnabled
    public static void deleteStaff(String staffId) {
        try {
            if (String.isBlank(staffId)) throw new AuraHandledException('Staff ID is required.');
            if (Schema.sObjectType.Account.isDeletable()) {
                delete [SELECT Id FROM Account WHERE Id = :staffId WITH SECURITY_ENFORCED LIMIT 1];
            } else {
                throw new AuraHandledException('Insufficient permissions to delete staff.');
            }
        } catch (AuraHandledException ahe) { throw ahe; }
        catch (Exception e) { throw new AuraHandledException('Error deleting staff: ' + e.getMessage()); }
    }

   
    @AuraEnabled
    public static String paySalary(String staffId, String invoiceMonth) {
        try {
            if (String.isBlank(staffId))      throw new AuraHandledException('Staff ID is required.');
            if (String.isBlank(invoiceMonth)) throw new AuraHandledException('Invoice month is required.');
            
            List<Account> accounts = [SELECT Id, Basic_Salary__c, HRA__c, DA__c, PF_Deduction__c FROM Account WHERE Id = :staffId WITH SECURITY_ENFORCED LIMIT 1];
            if (accounts.isEmpty()) throw new AuraHandledException('Staff member not found.');
            Account acc = accounts[0];
            Decimal basic = getSObjectDecimal(acc, 'Basic_Salary__c');
            Decimal hra   = getSObjectDecimal(acc, 'HRA__c');
            Decimal da    = getSObjectDecimal(acc, 'DA__c');
            Decimal pf    = getSObjectDecimal(acc, 'PF_Deduction__c');
            Decimal net   = basic + hra + da - pf;
            
            List<Invoice__c> existing = (List<Invoice__c>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id FROM Invoice__c WHERE Account__c = :staffId AND Invoice_Type__c = 'Salary' AND Invoice_Month__c = :invoiceMonth LIMIT 1]).getRecords();
            if (!existing.isEmpty()) {
                try { existing[0].put('Status__c', 'Paid'); } catch(Exception e) {} 
                try { existing[0].put('Invoice_Date__c', Date.today()); } catch(Exception e) {}
                existing[0].Total_Amount__c = net; 
                existing[0].Paid_Amount__c = net;
                if (!Schema.sObjectType.Invoice__c.isUpdateable()) {
                    throw new AuraHandledException('Insufficient permissions to update payroll invoices.');
                }
                SObjectAccessDecision decision = Security.stripInaccessible(AccessType.UPDATABLE, new List<Invoice__c>{existing[0]});
                update decision.getRecords(); 
                return decision.getRecords()[0].Id;
            } else {
                Invoice__c inv = new Invoice__c(Account__c = staffId, Invoice_Date__c = Date.today(), Due_Date__c = Date.today(), Status__c = 'Paid', Total_Amount__c = net, Paid_Amount__c = net, Invoice_Type__c = 'Salary', Invoice_Month__c = invoiceMonth, Description__c = 'Salary ' + invoiceMonth + ' | Net: ' + net);
                if (!Schema.sObjectType.Invoice__c.isCreateable()) {
                    throw new AuraHandledException('Insufficient permissions to create payroll invoices.');
                }
                SObjectAccessDecision decision = Security.stripInaccessible(AccessType.CREATABLE, new List<Invoice__c>{inv});
                insert decision.getRecords(); 
                return decision.getRecords()[0].Id;
            }
        } catch (AuraHandledException ahe) { throw ahe; }
        catch (Exception e) { throw new AuraHandledException('Payment failed: ' + e.getMessage()); }
    }


    @AuraEnabled
    public static void processAllPayroll(String invoiceMonth) {
        try {
            if (String.isBlank(invoiceMonth)) throw new AuraHandledException('Invoice month is required.');
            
            List<Account> allAccounts = [SELECT Id, Type, Basic_Salary__c, HRA__c, DA__c, PF_Deduction__c FROM Account WHERE IsPersonAccount = true WITH SECURITY_ENFORCED];
            List<Account> accounts = new List<Account>();
            for (Account acc : allAccounts) { 
                String accType = getSObjectField(acc, 'Type');
                if (accType == 'Teacher' || accType == 'Non Teaching Staff') { 
                    accounts.add(acc); 
                } 
            }
            if (accounts.isEmpty()) return;
            
            Set<Id> ids = new Map<Id, Account>(accounts).keySet();
            Map<Id, Invoice__c> existing = new Map<Id, Invoice__c>();
            for (Invoice__c inv : (List<Invoice__c>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Account__c FROM Invoice__c WHERE Invoice_Type__c = 'Salary' AND Invoice_Month__c = :invoiceMonth AND Account__c IN :ids]).getRecords()) { 
                Id accId = inv.Account__c;
                if (accId != null) existing.put(accId, inv); 
            }
            
            List<Invoice__c> toInsert = new List<Invoice__c>(); 
            List<Invoice__c> toUpdate = new List<Invoice__c>();
            
            for (Account acc : accounts) {
                Decimal basic = getSObjectDecimal(acc, 'Basic_Salary__c');
                Decimal hra   = getSObjectDecimal(acc, 'HRA__c');
                Decimal da    = getSObjectDecimal(acc, 'DA__c');
                Decimal pf    = getSObjectDecimal(acc, 'PF_Deduction__c');
                Decimal net   = basic + hra + da - pf;
                
                if (existing.containsKey(acc.Id)) {
                    Invoice__c inv = existing.get(acc.Id); 
                    inv.Status__c = 'Paid'; 
                    inv.Invoice_Date__c = Date.today(); 
                    inv.Total_Amount__c = net; 
                    inv.Paid_Amount__c = net; 
                    toUpdate.add(inv);
                } else {
                    toInsert.add(new Invoice__c(Account__c = acc.Id, Invoice_Date__c = Date.today(), Due_Date__c = Date.today(), Status__c = 'Paid', Total_Amount__c = net, Paid_Amount__c = net, Invoice_Type__c = 'Salary', Invoice_Month__c = invoiceMonth, Description__c = 'Salary ' + invoiceMonth));
                }
            }
            if (!toUpdate.isEmpty()) {
                if (!Schema.sObjectType.Invoice__c.isUpdateable()) {
                    throw new AuraHandledException('Insufficient permissions to update payroll invoices.');
                }
                SObjectAccessDecision decisionUpdate = Security.stripInaccessible(AccessType.UPDATABLE, toUpdate);
                update decisionUpdate.getRecords();
            }
            if (!toInsert.isEmpty()) {
                if (!Schema.sObjectType.Invoice__c.isCreateable()) {
                    throw new AuraHandledException('Insufficient permissions to create payroll invoices.');
                }
                SObjectAccessDecision decisionInsert = Security.stripInaccessible(AccessType.CREATABLE, toInsert);
                insert decisionInsert.getRecords();
            }
        } catch (AuraHandledException ahe) { throw ahe; }
        catch (Exception e) { throw new AuraHandledException('Payroll processing failed: ' + e.getMessage()); }
    }

   
    private static String safeStr(String val) { return val == null ? '' : val.trim(); }

    private static Map<Id, String> getSalaryStatusMap(Set<Id> accountIds) {
        Map<Id, String> result = new Map<Id, String>();
        if (accountIds == null || accountIds.isEmpty()) return result;
        for (Invoice__c inv : [SELECT Account__c, Status__c FROM Invoice__c WHERE Invoice_Type__c = 'Salary' AND Account__c IN :accountIds WITH SECURITY_ENFORCED ORDER BY Invoice_Date__c DESC]) {
            Id accId = inv.Account__c;
            String stat = inv.Status__c;
            if (accId != null && !result.containsKey(accId)) result.put(accId, stat == 'Paid' ? 'Paid' : 'Pending');
        }
        for (Id id : accountIds) if (!result.containsKey(id)) result.put(id, 'Pending');
        return result;
    }

    private static StaffWrapper toWrapper(Account acc, String salaryStatus) {
        StaffWrapper w = new StaffWrapper();
        w.id = acc.Id; 
        w.EmployeeId = getSObjectField(acc, 'Employee_ID__c'); 
        w.FirstName = getSObjectField(acc, 'FirstName'); 
        w.LastName = getSObjectField(acc, 'LastName');
        w.Name = acc.Name; 
        w.Gender = getSObjectField(acc, 'PersonGenderIdentity');
        w.Dob = getSObjectField(acc, 'PersonBirthdate');
        w.Email = getSObjectField(acc, 'PersonEmail'); 
        w.Phone = getSObjectField(acc, 'PersonMobilePhone'); 
        w.Address = getSObjectField(acc, 'PersonMailingStreet');
        w.StaffType = getSObjectField(acc, 'Type') == 'Teacher' ? 'Teaching' : 'Non-Teaching';
        w.Designation = getSObjectField(acc, 'Designation__c'); 
        w.Department = getSObjectField(acc, 'PersonDepartment'); 
        w.Subject = getSObjectField(acc, 'Subject_Taught__c');
        w.Qualification = getSObjectField(acc, 'Qualification__c');
        w.JoiningDate = getSObjectField(acc, 'Joining_Date__c');
        String status = getSObjectField(acc, 'Staff_Status__c');
        w.Status = String.isNotBlank(status) ? status : 'Active';
        w.BasicSalary = getSObjectDecimal(acc, 'Basic_Salary__c');
        w.Hra = getSObjectDecimal(acc, 'HRA__c'); 
        w.Da = getSObjectDecimal(acc, 'DA__c');
        w.Pf = getSObjectDecimal(acc, 'PF_Deduction__c');
        w.AccountNumber = getSObjectField(acc, 'Bank_Account_Number__c'); 
        w.Ifsc = getSObjectField(acc, 'IFSC_Code__c');
        w.SalaryStatus = salaryStatus != null ? salaryStatus : 'Pending';
        return w;
    }

    private static Id getPersonAccountRecordTypeId() {
        try {
            List<RecordType> rt = [SELECT Id FROM RecordType WHERE SObjectType = 'Account' AND IsPersonType = true AND IsActive = true WITH SECURITY_ENFORCED LIMIT 1];
            return rt.isEmpty() ? null : rt[0].Id;
        } catch (Exception e) { return null; }
    }

    private static String generateEmployeeId(Id accountId, String staffType) {
        return ((staffType == 'Teaching') ? 'TCH' : 'NTS') + '-' + String.valueOf(accountId).right(5).toUpperCase();
    }


    private static Object getSafe(SObject obj, String field) {
        try {
            return obj.get(field);
        } catch (Exception e) { return null; }
    }
    private static String getSObjectField(SObject obj, String field) {
        Object val = NamespaceUtils.getValue(obj, field);
        return val != null ? String.valueOf(val) : null;
    }

    private static Decimal getSObjectDecimal(SObject obj, String field) {
        Object val = NamespaceUtils.getValue(obj, field);
        if (val instanceof Decimal) return (Decimal)val;
        if (val instanceof Integer) return Decimal.valueOf((Integer)val);
        return 0;
    }
}
