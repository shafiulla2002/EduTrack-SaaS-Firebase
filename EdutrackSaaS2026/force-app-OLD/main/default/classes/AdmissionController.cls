public without sharing class AdmissionController {
    
    @AuraEnabled(cacheable=true)
    public static List<PricebookEntry> getActiveProducts(String classId, String academicYearId) {
        if (String.isBlank(classId)) {
            return new List<PricebookEntry>();
        }

        String className = '';
        try {
            Class__c cls = [SELECT Name FROM Class__c WHERE Id = :classId LIMIT 1];
            className = cls.Name;
        } catch (Exception e) {
            System.debug('Class not found for Id: ' + classId);
            return new List<PricebookEntry>();
        }

        String priceBookName    = className.replace('-', ' ');
        String priceBookNameAlt = className.replace(' ', '-');

        List<Pricebook2> classPriceBooks;
        if (String.isNotBlank(academicYearId)) {
            String pbNameLike    = priceBookName    + ' - %';
            String pbNameLikeAlt = priceBookNameAlt + ' - %';
            classPriceBooks = [
                SELECT Id, Name
                FROM Pricebook2 
                WHERE (
                    Name = :priceBookName    OR 
                    Name = :priceBookNameAlt OR 
                    Name LIKE :pbNameLike    OR 
                    Name LIKE :pbNameLikeAlt
                )
                AND IsActive = true 
                AND (Academic_Year__c = :academicYearId OR Academic_Year__c = NULL)
                ORDER BY Academic_Year__c NULLS LAST
                LIMIT 1
            ];
        } else {
            classPriceBooks = [
                SELECT Id, Name
                FROM Pricebook2 
                WHERE (Name = :priceBookName OR Name = :priceBookNameAlt)
                AND IsActive = true 
                LIMIT 1
            ];
        }

        if (classPriceBooks.isEmpty()) {
            return new List<PricebookEntry>();
        }

        return [
            SELECT Id, Product2Id, Product2.Name, Product2.Description, UnitPrice, Pricebook2Id
            FROM PricebookEntry 
            WHERE IsActive = true 
            AND Pricebook2Id = :classPriceBooks[0].Id
            AND Pricebook2.IsActive = true
            AND Product2.ProductCode != 'PREV_DUES'
            AND (NOT Product2.Name LIKE '%Previous%')
            ORDER BY Product2.Name ASC
        ];
    }

    @AuraEnabled
    public static Map<String, Object> createAdmission(Map<String, String> studentData, List<Id> selectedPricebookEntryIds, Decimal concessionAmount) {
        try {
            Id personAccountRecordTypeId = [SELECT Id FROM RecordType WHERE SobjectType='Account' AND IsPersonType=true LIMIT 1].Id;

            Id classId   = String.isNotBlank(studentData.get('selectedClass'))   ? (Id) studentData.get('selectedClass')   : null;
            Id sectionId = String.isNotBlank(studentData.get('selectedSection')) ? (Id) studentData.get('selectedSection') : null;

            Account student = new Account();
            student.RecordTypeId = personAccountRecordTypeId;
            student.FirstName = studentData.get('firstName');
            student.LastName  = studentData.get('lastName');
            student.PersonEmail = studentData.get('email');
            String phoneValue = studentData.get('phone');
            student.PersonMobilePhone = phoneValue;
            student.Phone = phoneValue;
            student.put('Father_Name__c', studentData.get('fatherName'));
            student.put('Mother_Name__c', studentData.get('motherName'));
            if (String.isNotBlank(studentData.get('dob'))) {
                try { student.PersonBirthdate = Date.valueOf(studentData.get('dob')); } catch (Exception e) {}
            }
            student.put('Emergency_Contact__c', studentData.get('emergencyContact'));
            if (String.isNotBlank(studentData.get('aadharNo'))) {
                student.put('Aadhar_Card_No__c', studentData.get('aadharNo'));
            }
            student.PersonMailingCity       = studentData.get('city');
            student.PersonMailingPostalCode = studentData.get('pincode');
            student.put('State__c',   studentData.get('state'));
            student.put('Country__c', studentData.get('country'));
            student.put('Village__c', studentData.get('village'));
            student.PersonMailingStreet = studentData.get('village');
            student.BillingStreet       = studentData.get('village');
            student.Type = 'Student';
            student.put('Active__c',   'Yes');
            student.put('Class__c',   classId);
            student.put('Section__c', sectionId);
            insert student;

            String academicYearName = '';
            if (String.isNotBlank(studentData.get('academicYear'))) {
                Academic_Year__c ay = [SELECT Name FROM Academic_Year__c WHERE Id = :studentData.get('academicYear') LIMIT 1];
                academicYearName = ay.Name;
            }

            Opportunity opp = new Opportunity();
            opp.Name = (student.FirstName != null ? student.FirstName + ' ' : '') + student.LastName + ' - Admission ' + academicYearName;
            opp.AccountId  = student.Id;
            opp.StageName  = 'Prospecting';
            opp.CloseDate  = Date.today().addDays(30);
            opp.put('Class__c',        classId);
            opp.put('Section__c',      sectionId);
            opp.put('Academic_Year__c', studentData.get('academicYear'));
            insert opp;

            if (!selectedPricebookEntryIds.isEmpty()) {
                List<PricebookEntry> pbes = [SELECT Id, UnitPrice FROM PricebookEntry WHERE Id IN :selectedPricebookEntryIds];
                Decimal totalAmount = 0;
                for (PricebookEntry pbe : pbes) totalAmount += pbe.UnitPrice;

                Decimal discountPercent = 0;
                if (totalAmount > 0 && concessionAmount > 0) {
                    discountPercent = (concessionAmount / totalAmount) * 100;
                    if (discountPercent > 100) discountPercent = 100;
                }

                List<OpportunityLineItem> olis = new List<OpportunityLineItem>();
                for (PricebookEntry pbe : pbes) {
                    olis.add(new OpportunityLineItem(
                        OpportunityId    = opp.Id,
                        PricebookEntryId = pbe.Id,
                        Quantity         = 1,
                        UnitPrice        = pbe.UnitPrice,
                        Discount         = discountPercent
                    ));
                }
                insert olis;
            }

            return new Map<String, Object>{
                'success'       => true,
                'opportunityId' => opp.Id,
                'accountId'     => student.Id
            };
        } catch (Exception e) {
            throw new AuraHandledException('Error creating admission: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getAcademicYearOptions() {
        List<Map<String, String>> options = new List<Map<String, String>>();
        for (Academic_Year__c ay : [SELECT Id, Name FROM Academic_Year__c WHERE Is_Active__c = true ORDER BY Start_Date__c ASC]) {
            options.add(new Map<String, String>{ 'label' => ay.Name, 'value' => ay.Id });
        }
        return options;
    }

    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getClassOptions() {
        List<Map<String, String>> options = new List<Map<String, String>>();
        try {
            for (Class__c cls : [SELECT Id, Name FROM Class__c ORDER BY Name ASC]) {
                options.add(new Map<String, String>{ 'label' => cls.Name, 'value' => cls.Id });
            }
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching classes: ' + e.getMessage());
        }
        return options;
    }

    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getSectionOptions(String classId) {
        List<Map<String, String>> options = new List<Map<String, String>>();
        for (Section__c sec : [SELECT Id, Name FROM Section__c ORDER BY Name ASC]) {
            options.add(new Map<String, String>{ 'label' => sec.Name, 'value' => sec.Id });
        }
        return options;
    }

    public class StudentSearchResult {
        @AuraEnabled public Map<String, Object> account { get; set; }
        @AuraEnabled public Decimal totalPendingBalance { get; set; }
        @AuraEnabled public Decimal totalPaidAmount     { get; set; }
        public StudentSearchResult(Map<String, Object> acc, Decimal balance, Decimal paid) {
            this.account = acc; this.totalPendingBalance = balance; this.totalPaidAmount = paid;
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<StudentSearchResult> searchStudents(String searchTerm, Double timestamp) {
        String query = '%' + searchTerm + '%';
        List<Account> accounts = [
    SELECT Id, Name, PersonMobilePhone, Class__c, Section__c,
           Class__r.Name, Section__r.Name,
           (SELECT Id, Academic_Year__c FROM Opportunities WHERE IsClosed = false ORDER BY CreatedDate DESC)
    FROM Account
    WHERE IsPersonAccount = true
    AND (Name LIKE :query OR PersonMobilePhone LIKE :query)
    LIMIT 20
];
        Set<Id> accIds = new Set<Id>();
        for (Account acc : accounts) accIds.add(acc.Id);

        Map<Id, Decimal> accountToTotalFee = new Map<Id, Decimal>();
        for (AggregateResult ar : [SELECT Opportunity.AccountId accId, SUM(TotalPrice) total FROM OpportunityLineItem WHERE Opportunity.AccountId IN :accIds AND Opportunity.IsClosed = false GROUP BY Opportunity.AccountId]) {
            accountToTotalFee.put((Id)ar.get('accId'), (Decimal)ar.get('total'));
        }

        Map<Id, Decimal> accountToTotalPaid = new Map<Id, Decimal>();
        for (AggregateResult ar : [SELECT Invoice__r.Student__c studentId, SUM(Amount__c) total FROM Invoice_Item__c WHERE Invoice__r.Student__c IN :accIds AND Invoice__r.Opportunity__r.IsClosed = false AND Invoice__r.Status__c != 'Cancelled' GROUP BY Invoice__r.Student__c]) {
            accountToTotalPaid.put((Id)ar.get('studentId'), (Decimal)ar.get('total'));
        }

        List<StudentSearchResult> results = new List<StudentSearchResult>();
        for (Account acc : accounts) {
    Decimal total = accountToTotalFee.containsKey(acc.Id)  ? accountToTotalFee.get(acc.Id)  : 0;
    Decimal paid  = accountToTotalPaid.containsKey(acc.Id) ? accountToTotalPaid.get(acc.Id) : 0;
    Map<String, Object> accMap = NamespaceUtils.stripNamespace(acc);
    // Overwrite ID fields with human-readable names
    accMap.put('Class__c',   acc.Class__r != null   ? acc.Class__r.Name   : '');
    accMap.put('Section__c', acc.Section__r != null ? acc.Section__r.Name : '');
    results.add(new StudentSearchResult(accMap, total - paid, paid));
}

        return results;
    }

    @AuraEnabled(cacheable=true)
    public static StudentSearchResult getStudentById(Id studentId, Double timestamp) {
        Account acc = [
    SELECT Id, Name, PersonMobilePhone, Class__c, Section__c,
           Class__r.Name, Section__r.Name,
           (SELECT Id, Academic_Year__c FROM Opportunities WHERE IsClosed = false ORDER BY CreatedDate DESC)
    FROM Account WHERE Id = :studentId LIMIT 1
];
        Decimal total = 0;
        AggregateResult[] feeRes = [SELECT SUM(TotalPrice) total FROM OpportunityLineItem WHERE Opportunity.AccountId = :studentId AND Opportunity.IsClosed = false];
        if (!feeRes.isEmpty() && feeRes[0].get('total') != null) total = (Decimal)feeRes[0].get('total');
        Decimal paid = 0;
        AggregateResult[] paidRes = [SELECT SUM(Amount__c) total FROM Invoice_Item__c WHERE Invoice__r.Student__c = :studentId AND Invoice__r.Opportunity__r.IsClosed = false AND Invoice__r.Status__c != 'Cancelled'];
        if (!paidRes.isEmpty() && paidRes[0].get('total') != null) paid = (Decimal)paidRes[0].get('total');
        return new StudentSearchResult(NamespaceUtils.stripNamespace(acc), total - paid, paid);
    }

    @AuraEnabled(cacheable=true)
    public static String getInvoicePDFUrl(Id invoiceId) {
        return URL.getOrgDomainUrl().toExternalForm() + '/apex/AdmissionInvoice?id=' + invoiceId;
    }

    public class FeeWrapper {
        @AuraEnabled public String  oliId           { get; set; }
        @AuraEnabled public String  productName     { get; set; }
        @AuraEnabled public Decimal totalAmount     { get; set; }
        @AuraEnabled public Decimal netAmount       { get; set; }
        @AuraEnabled public Decimal paidAmount      { get; set; }
        @AuraEnabled public Decimal balanceDue      { get; set; }
        @AuraEnabled public String  productId       { get; set; }
        @AuraEnabled public Decimal discountPercent { get; set; }
        @AuraEnabled public Decimal discountAmount  { get; set; }
        public FeeWrapper(OpportunityLineItem oli, Decimal paid) {
            this.oliId           = oli.Id;
            this.productName     = oli.Product2.Name;
            this.totalAmount     = oli.UnitPrice;
            this.discountPercent = oli.Discount != null ? oli.Discount : 0;
            this.discountAmount  = (this.totalAmount * this.discountPercent) / 100;
            this.netAmount       = this.totalAmount - this.discountAmount;
            this.paidAmount      = paid;
            this.balanceDue      = this.netAmount - paid;
            this.productId       = oli.Product2Id;
        }
    }

    @AuraEnabled
    public static List<FeeWrapper> getUnpaidFees(Id opportunityId) {
        Map<String, Decimal> oliToPaidAmount = new Map<String, Decimal>();
        for (Invoice_Item__c item : [
            SELECT Opportunity_Line_Item_Id__c, Amount__c
            FROM Invoice_Item__c
            WHERE Invoice__r.Opportunity__c = :opportunityId AND Invoice__r.Status__c != 'Cancelled'
        ]) {
            String oliId  = item.Opportunity_Line_Item_Id__c;
            Decimal current = oliToPaidAmount.containsKey(oliId) ? oliToPaidAmount.get(oliId) : 0;
            oliToPaidAmount.put(oliId, current + (item.Amount__c != null ? item.Amount__c : 0));
        }
        List<FeeWrapper> results = new List<FeeWrapper>();
        for (OpportunityLineItem oli : [
            SELECT Id, Product2Id, Product2.Name, UnitPrice, Discount, TotalPrice
            FROM OpportunityLineItem WHERE OpportunityId = :opportunityId
        ]) {
            results.add(new FeeWrapper(oli, oliToPaidAmount.containsKey(oli.Id) ? oliToPaidAmount.get(oli.Id) : 0));
        }
        return results;
    }

    @AuraEnabled
    public static Id createInvoice(Id opportunityId, Id studentId, List<Map<String, Object>> selectedItems, String paymentMethod, Map<String, String> bankDetails) {
        if (selectedItems == null || selectedItems.isEmpty()) {
            throw new AuraHandledException('No fee items selected for payment.');
        }
        Decimal totalAmount = 0;
        for (Map<String, Object> itemData : selectedItems) {
            totalAmount += Decimal.valueOf(String.valueOf(itemData.get('amount')));
        }
        if (totalAmount <= 0) {
            throw new AuraHandledException('The total payment amount must be greater than zero.');
        }
        try {
            Invoice__c inv = new Invoice__c(
                Opportunity__c   = opportunityId,
                Student__c       = studentId,
                Status__c        = 'Paid',
                Invoice_Date__c  = Date.today(),
                Payment_Method__c = paymentMethod
            );
            if (bankDetails != null && !bankDetails.isEmpty()) {
                inv.Bank_Name__c           = bankDetails.get('bankName');
                inv.Bank_IFSC__c           = bankDetails.get('bankIfsc');
                inv.Bank_Account_Number__c = bankDetails.get('bankAccountNumber');
                inv.Bank_Branch__c         = bankDetails.get('bankBranch');
            }
            insert inv;

            List<Invoice_Item__c> items = new List<Invoice_Item__c>();
            for (Map<String, Object> itemData : selectedItems) {
                items.add(new Invoice_Item__c(
                    Invoice__c                  = inv.Id,
                    Opportunity_Line_Item_Id__c = (String) itemData.get('oliId'),
                    Opportunity_Product__c      = (Id)     itemData.get('oliId'),
                    Product__c                  = (Id)     itemData.get('productId'),
                    Amount__c                   = Decimal.valueOf(String.valueOf(itemData.get('amount')))
                ));
            }
            insert items;
            return inv.Id;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    public class InvoiceWrapper {
        @AuraEnabled public Id      id           { get; set; }
        @AuraEnabled public String  name         { get; set; }
        @AuraEnabled public Date    invoiceDate  { get; set; }
        @AuraEnabled public String  status       { get; set; }
        @AuraEnabled public Decimal totalAmount  { get; set; }
        public InvoiceWrapper(Invoice__c inv) {
            this.id = inv.Id; this.name = inv.Name; this.invoiceDate = inv.Invoice_Date__c;
            this.status = inv.Status__c; this.totalAmount = 0;
            if (inv.Invoice_Items__r != null) {
                for (Invoice_Item__c item : inv.Invoice_Items__r) this.totalAmount += (item.Amount__c != null ? item.Amount__c : 0);
            }
        }
    }

    @AuraEnabled
    public static List<InvoiceWrapper> getRecentInvoices(Id studentId) {
        List<InvoiceWrapper> results = new List<InvoiceWrapper>();
        for (Invoice__c inv : [
            SELECT Id, Name, Invoice_Date__c, Status__c, (SELECT Amount__c FROM Invoice_Items__r)
            FROM Invoice__c WHERE Student__c = :studentId AND Status__c != 'Cancelled' ORDER BY CreatedDate DESC LIMIT 5
        ]) results.add(new InvoiceWrapper(inv));
        return results;
    }

    @AuraEnabled
    public static void voidInvoice(Id invoiceId) {
        try {
            Invoice__c inv = [SELECT Id, Status__c FROM Invoice__c WHERE Id = :invoiceId LIMIT 1];
            inv.Status__c = 'Cancelled';
            update inv;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getAdmissionPicklistValues() {
        Map<String, Object> picklistValues = new Map<String, Object>();
        Map<String, Schema.SObjectField> fieldMap = Account.SObjectType.getDescribe().fields.getMap();
        for (String fieldName : new String[]{ 'State__c', 'Country__c' }) {
            List<Map<String, String>> options = new List<Map<String, String>>();
            Schema.SObjectField field = fieldMap.get(fieldName);
            if (field != null) {
                for (Schema.PicklistEntry f : field.getDescribe().getPicklistValues()) {
                    if (f.isActive()) options.add(new Map<String, String>{ 'label' => f.getLabel(), 'value' => f.getValue() });
                }
            }
            picklistValues.put(fieldName, options);
        }
        return picklistValues;
    }

    @AuraEnabled
    public static String getQRCodeBase64(String qrUrl) {
        try {
            Http h = new Http(); HttpRequest req = new HttpRequest();
            req.setEndpoint(qrUrl); req.setMethod('GET'); req.setTimeout(10000);
            HttpResponse res = h.send(req);
            if (res.getStatusCode() == 200) return EncodingUtil.base64Encode(res.getBodyAsBlob());
            throw new AuraHandledException('Failed to fetch QR code. Status: ' + res.getStatus());
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching QR code: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void updateLineItemDiscount(Id oliId, Decimal discountPercent) {
        try {
            OpportunityLineItem oli = [SELECT Id, Discount FROM OpportunityLineItem WHERE Id = :oliId LIMIT 1];
            oli.Discount = discountPercent; update oli;
        } catch (Exception e) {
            throw new AuraHandledException('Error updating concession: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void updateBulkLineItemDiscounts(List<String> oliIds, Decimal discountPercent) {
        try {
            List<OpportunityLineItem> olisToUpdate = [SELECT Id, Discount FROM OpportunityLineItem WHERE Id IN :oliIds];
            for (OpportunityLineItem oli : olisToUpdate) oli.Discount = discountPercent;
            if (!olisToUpdate.isEmpty()) update olisToUpdate;
        } catch (Exception e) {
            throw new AuraHandledException('Error applying bulk concession: ' + e.getMessage());
        }
    }

    // ✅ UPDATED: Template now clearly labels that Class and Section expect the Name (text), not an Id
    @AuraEnabled
    public static String getAdmissionCSVTemplate() {
        return 'First Name,Last Name,Father Name,Mother Name,DOB,Phone,Email,Aadhar No,Village,City,Pincode,State,Country,Class,Section,Academic Year';
    }

    @AuraEnabled
    public static Map<String, Object> importStudentsBulk(List<Map<String, String>> studentDataList) {
        Integer successCount = 0;
        List<String> errors  = new List<String>();

        try {
            Id personAccountRecordTypeId = [
                SELECT Id FROM RecordType
                WHERE SobjectType = 'Account' AND IsPersonType = true LIMIT 1
            ].Id;

            // ── Academic Year name → Id map ──────────────────────────────────────────
            Map<String, Id> ayMap = new Map<String, Id>();
            for (Academic_Year__c ay : [SELECT Id, Name FROM Academic_Year__c]) {
                if (ay.Name != null) ayMap.put(ay.Name.replaceAll('–', '-'), ay.Id);
            }

            // ── ✅ Class name → Id map (lookup resolution) ────────────────────────────
            Map<String, Id> classNameToId = new Map<String, Id>();
            for (Class__c cls : [SELECT Id, Name FROM Class__c]) {
                if (cls.Name != null) {
                    classNameToId.put(cls.Name.toLowerCase().trim(), cls.Id);
                }
            }

            // ── ✅ Section name → Id map (lookup resolution) ──────────────────────────
            Map<String, Id> sectionNameToId = new Map<String, Id>();
            for (Section__c sec : [SELECT Id, Name FROM Section__c]) {
                if (sec.Name != null) {
                    sectionNameToId.put(sec.Name.toLowerCase().trim(), sec.Id);
                }
            }

            // ── Pricebook cache (keyed by class name, not Id) ─────────────────────────
            Set<String> classNamesForPB = new Set<String>();
            for (Map<String, String> data : studentDataList) {
                String rawClass = data.get('Class');
                if (rawClass != null) classNamesForPB.add(rawClass.replace('-', ' ').trim());
            }

            Map<String, List<PricebookEntry>> pbeCache = new Map<String, List<PricebookEntry>>();
            for (PricebookEntry pbe : [
                SELECT Id, Product2Id, Product2.Name, UnitPrice, Pricebook2Id,
                       Pricebook2.Name, Pricebook2.Academic_Year__c
                FROM PricebookEntry
                WHERE IsActive = true
                AND Pricebook2.IsActive = true
                AND Product2.ProductCode != 'PREV_DUES'
                AND (NOT Product2.Name LIKE '%Previous%')
                AND Pricebook2.Name LIKE 'Class %'
            ]) {
                for (String cls : classNamesForPB) {
                    if (pbe.Pricebook2.Name != null) {
                        String pbNameClean = pbe.Pricebook2.Name.replaceAll('–', '-');
                        if (pbNameClean == cls || pbNameClean.startsWith(cls + ' -')) {
                            String key         = cls + '-' + (pbe.Pricebook2.Academic_Year__c != null ? String.valueOf(pbe.Pricebook2.Academic_Year__c) : 'null');
                            String fallbackKey = cls + '-null';
                            if (!pbeCache.containsKey(key))         pbeCache.put(key, new List<PricebookEntry>());
                            if (!pbeCache.containsKey(fallbackKey)) pbeCache.put(fallbackKey, new List<PricebookEntry>());
                            pbeCache.get(key).add(pbe);
                            if (pbe.Pricebook2.Academic_Year__c != null) pbeCache.get(fallbackKey).add(pbe);
                        }
                    }
                }
            }

            // ── Build Account list ────────────────────────────────────────────────────
            List<Account>            accountsToInsert  = new List<Account>();
            List<Map<String, String>> validStudentRowData = new List<Map<String, String>>();

            for (Integer i = 0; i < studentDataList.size(); i++) {
                Map<String, String> data = studentDataList[i];
                try {
                    // ✅ Resolve Class name → Id
                    String rawClassName = data.get('Class');
                    Id classId = null;
                    if (String.isNotBlank(rawClassName)) {
                        classId = classNameToId.get(rawClassName.toLowerCase().trim());
                        if (classId == null) {
                            errors.add('Row ' + (i + 1) + ': Class "' + rawClassName + '" not found. Please check the Class name matches exactly.');
                            continue;
                        }
                    }

                    // ✅ Resolve Section name → Id
                    String rawSectionName = data.get('Section');
                    Id sectionId = null;
                    if (String.isNotBlank(rawSectionName)) {
                        sectionId = sectionNameToId.get(rawSectionName.toLowerCase().trim());
                        if (sectionId == null) {
                            errors.add('Row ' + (i + 1) + ': Section "' + rawSectionName + '" not found. Please check the Section name matches exactly.');
                            continue;
                        }
                    }

                    Account acc = new Account(
                        RecordTypeId     = personAccountRecordTypeId,
                        FirstName        = data.get('First Name'),
                        LastName         = data.get('Last Name'),
                        PersonEmail      = data.get('Email'),
                        Phone            = data.get('Phone'),
                        PersonMobilePhone = data.get('Phone')
                    );
                    acc.put('Father_Name__c', data.get('Father Name'));
                    acc.put('Mother_Name__c', data.get('Mother Name'));

                    String dobStr = data.containsKey('DOB') ? data.get('DOB') : data.get('DOB (YYYY-MM-DD)');
                    if (String.isNotBlank(dobStr)) acc.PersonBirthdate = parseFlexibleDate(dobStr);

                    acc.put('Aadhar_Card_No__c', data.get('Aadhar No'));
                    acc.put('Village__c', data.get('Village'));
                    acc.PersonMailingCity       = data.get('City');
                    acc.PersonMailingPostalCode = data.get('Pincode');
                    acc.put('State__c',   data.get('State'));
                    acc.put('Country__c', data.get('Country'));
                    acc.Type = 'Student';
                    acc.put('Active__c', 'Yes');

                    // ✅ Set lookup Ids (not names)
                    acc.put('Class__c',   classId);
                    acc.put('Section__c', sectionId);

                    accountsToInsert.add(acc);
                    // Store resolved Ids back so Opportunity can reuse them
                    data.put('_resolvedClassId',   classId != null ? String.valueOf(classId) : '');
data.put('_resolvedSectionId', sectionId != null ? String.valueOf(sectionId) : '');
                    validStudentRowData.add(data);

                } catch (Exception e) {
                    errors.add('Row ' + (i + 1) + ': ' + e.getMessage());
                }
            }

            // ── Insert Accounts ───────────────────────────────────────────────────────
            if (!accountsToInsert.isEmpty()) {
                Database.SaveResult[] srList = Database.insert(accountsToInsert, false);

                List<Opportunity>        oppsToInsert    = new List<Opportunity>();
                List<Map<String, String>> successRowData  = new List<Map<String, String>>();
                List<Account>            successAccounts = new List<Account>();

                for (Integer i = 0; i < srList.size(); i++) {
                    if (srList[i].isSuccess()) {
                        Account acc              = accountsToInsert[i];
                        Map<String, String> data = validStudentRowData[i];
                        Id ayId = null;
if (data.containsKey('Academic Year') && ayMap.containsKey(data.get('Academic Year'))) {
    ayId = ayMap.get(data.get('Academic Year'));
}

                        // ✅ Use pre-resolved Ids from the data map
                        Id classId = null;
if (String.isNotBlank(data.get('_resolvedClassId'))) {
    classId = Id.valueOf(data.get('_resolvedClassId'));
}

Id sectionId = null;
if (String.isNotBlank(data.get('_resolvedSectionId'))) {
    sectionId = Id.valueOf(data.get('_resolvedSectionId'));
}

                        Opportunity opp = new Opportunity(
                            AccountId  = srList[i].getId(),
                            StageName  = 'Prospecting',
                            CloseDate  = Date.today().addDays(30)
                        );
                        opp.Name = acc.FirstName + ' ' + acc.LastName + ' - Admission ' + (data.get('Academic Year') != null ? data.get('Academic Year') : '');
                        opp.put('Class__c',        classId);
                        opp.put('Section__c',      sectionId);
                        opp.put('Academic_Year__c', ayId);

                        oppsToInsert.add(opp);
                        successRowData.add(data);
                        successAccounts.add(acc);
                    } else {
                        errors.add('Row account error: ' + srList[i].getErrors()[0].getMessage());
                    }
                }

                // ── Insert Opportunities ──────────────────────────────────────────────
                if (!oppsToInsert.isEmpty()) {
                    Database.SaveResult[] srOppList = Database.insert(oppsToInsert, false);
                    List<OpportunityLineItem> olisToInsert = new List<OpportunityLineItem>();

                    for (Integer i = 0; i < srOppList.size(); i++) {
                        if (srOppList[i].isSuccess()) {
                            Id oppId             = srOppList[i].getId();
                            Map<String, String> data = successRowData[i];
                            Id ayId              = ayMap.get(data.get('Academic Year'));

                            String pbName    = data.get('Class') != null ? data.get('Class').replace('-', ' ').trim() : '';
                            String cacheKey  = pbName + '-' + (ayId != null ? String.valueOf(ayId) : 'null');
                            String fallback  = pbName + '-null';
                            List<PricebookEntry> pbes = pbeCache.containsKey(cacheKey)
                                ? pbeCache.get(cacheKey)
                                : (pbeCache.containsKey(fallback) ? pbeCache.get(fallback) : new List<PricebookEntry>());

                            for (PricebookEntry pbe : pbes) {
                                olisToInsert.add(new OpportunityLineItem(
                                    OpportunityId    = oppId,
                                    PricebookEntryId = pbe.Id,
                                    Quantity         = 1,
                                    UnitPrice        = pbe.UnitPrice
                                ));
                            }
                            successCount++;
                        } else {
                            errors.add('Row opp error: ' + srOppList[i].getErrors()[0].getMessage());
                        }
                    }

                    if (!olisToInsert.isEmpty()) {
                        insert olisToInsert;
                    }
                }
            }

        } catch (Exception e) {
            throw new AuraHandledException('Bulk Import Failed: ' + e.getMessage());
        }

        return new Map<String, Object>{
            'successCount' => successCount,
            'errors'       => errors,
            'totalRows'    => studentDataList.size()
        };
    }

    private static Date parseFlexibleDate(String dateStr) {
        if (String.isBlank(dateStr)) return null;
        try { return Date.valueOf(dateStr); }
        catch (Exception e) {
            try {
                String cleanDate = dateStr.replaceAll('/', '-');
                List<String> parts = cleanDate.split('-');
                if (parts.size() == 3) {
                    if (parts[0].length() <= 2 && parts[2].length() == 4)
                        return Date.newInstance(Integer.valueOf(parts[2]), Integer.valueOf(parts[1]), Integer.valueOf(parts[0]));
                    else if (parts[2].length() <= 2 && parts[0].length() == 4)
                        return Date.newInstance(Integer.valueOf(parts[0]), Integer.valueOf(parts[1]), Integer.valueOf(parts[2]));
                }
            } catch (Exception ex) {}
        }
        throw new IllegalArgumentException('Invalid date: ' + dateStr + '. Expected YYYY-MM-DD or DD-MM-YYYY.');
    }
}