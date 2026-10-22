public with sharing class AdmissionController {
    
    @AuraEnabled
    public static List<PricebookEntry> getActiveProducts(String classId, String academicYearId) {
        if (String.isBlank(classId)) {
            return new List<PricebookEntry>();
        }

        String className = '';
        try {
            List<Class__c> classes = (List<Class__c>)Security.stripInaccessible(AccessType.READABLE, [SELECT Name FROM Class__c WHERE Id = :classId LIMIT 1]).getRecords();
            if (!classes.isEmpty()) className = classes[0].Name;
        } catch (Exception e) {
            return new List<PricebookEntry>();
        }

        String priceBookName    = className.replace('-', ' ');
        String priceBookNameAlt = className.replace(' ', '-');

        List<Pricebook2> classPriceBooks;
        if (String.isNotBlank(academicYearId)) {
            String pbNameLike    = priceBookName    + ' - %';
            String pbNameLikeAlt = priceBookNameAlt + ' - %';
            classPriceBooks = (List<Pricebook2>)Security.stripInaccessible(AccessType.READABLE, [
                SELECT Id, Name
                FROM Pricebook2 
                WHERE (
                    Name = :priceBookName    OR 
                    Name = :priceBookNameAlt OR 
                    Name LIKE :pbNameLike    OR 
                    Name LIKE :pbNameLikeAlt
                )
                AND IsActive = true 
                AND Academic_Year__c = :academicYearId
                ORDER BY Academic_Year__c NULLS LAST
                LIMIT 1
            ]).getRecords();
        } else {
            classPriceBooks = (List<Pricebook2>)Security.stripInaccessible(AccessType.READABLE, [
                SELECT Id, Name
                FROM Pricebook2 
                WHERE (Name = :priceBookName OR Name = :priceBookNameAlt)
                AND IsActive = true
                LIMIT 1
            ]).getRecords();
        }

        if (classPriceBooks.isEmpty()) {
            return new List<PricebookEntry>();
        }

        return (List<PricebookEntry>)Security.stripInaccessible(AccessType.READABLE, [
            SELECT Id, Product2Id, Product2.Name, Product2.Description, UnitPrice, Pricebook2Id
            FROM PricebookEntry 
            WHERE IsActive = true 
            AND Pricebook2Id = :classPriceBooks[0].Id
            AND Pricebook2.IsActive = true
            AND Product2.ProductCode != 'PREV_DUES'
            AND (NOT Product2.Name LIKE '%Previous%')
            ORDER BY Product2.Name ASC
            LIMIT 1000
        ]).getRecords();
    }

    @AuraEnabled
    public static Map<String, Object> createAdmission(Map<String, String> studentData, List<Id> selectedPricebookEntryIds, Decimal concessionAmount) {
        try {
            List<RecordType> rts = (List<RecordType>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id FROM RecordType WHERE SobjectType='Account' AND IsPersonType=true LIMIT 1]).getRecords();
            if (rts.isEmpty()) throw new AuraHandledException('Person Account Record Type not found.');
            Id personAccountRecordTypeId = rts[0].Id;

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
            student.put(NamespaceUtils.withNamespace('Father_Name__c'), studentData.get('fatherName'));
            student.put(NamespaceUtils.withNamespace('Mother_Name__c'), studentData.get('motherName'));
            if (String.isNotBlank(studentData.get('dob'))) {
                try { 
                    student.PersonBirthdate = Date.valueOf(studentData.get('dob')); 
                } catch (Exception e) { 
                    // Invalid date format from UI, skip setting PersonBirthdate
                    System.debug('AdmissionController: Skipping invalid DOB: ' + e.getMessage());
                }
            }
            student.put(NamespaceUtils.withNamespace('Emergency_Contact__c'), studentData.get('emergencyContact'));
            if (String.isNotBlank(studentData.get('aadharNo'))) {
                student.put(NamespaceUtils.withNamespace('Aadhar_Card_No__c'), studentData.get('aadharNo'));
            }
            student.PersonMailingCity       = studentData.get('city');
            student.PersonMailingPostalCode = studentData.get('pincode');
            student.put(NamespaceUtils.withNamespace('State__c'),   studentData.get('state'));
            student.put(NamespaceUtils.withNamespace('Country__c'), studentData.get('country'));
            student.put(NamespaceUtils.withNamespace('Village__c'), studentData.get('village'));
            student.PersonMailingStreet = studentData.get('village');
            student.BillingStreet       = studentData.get('village');
            student.Type = 'Student';
            student.put(NamespaceUtils.withNamespace('Active__c'),   'Yes');
            student.put(NamespaceUtils.withNamespace('Class__c'),   classId);
            student.put(NamespaceUtils.withNamespace('Section__c'), sectionId);
            if (!Schema.sObjectType.Account.isCreateable()) {
                throw new AuraHandledException('Insufficient permissions to create student accounts.');
            }
            SObjectAccessDecision decision = Security.stripInaccessible(AccessType.CREATABLE, new List<Account>{student});
            insert decision.getRecords();
            student = (Account) decision.getRecords()[0];

            String academicYearName = '';
            if (String.isNotBlank(studentData.get('academicYear'))) {
                List<Academic_Year__c> ays = [SELECT Name FROM Academic_Year__c WHERE Id = :studentData.get('academicYear') WITH SECURITY_ENFORCED LIMIT 1];
                if (!ays.isEmpty()) {
                    academicYearName = ays[0].Name;
                }
            }

            Opportunity opp = new Opportunity();
            opp.Name = (student.FirstName != null ? student.FirstName + ' ' : '') + student.LastName + ' - Admission ' + academicYearName;
            opp.AccountId  = student.Id;
            opp.StageName  = 'Prospecting';
            opp.CloseDate  = Date.today().addDays(30);
            opp.put(NamespaceUtils.withNamespace('Class__c'),        classId);
            opp.put(NamespaceUtils.withNamespace('Section__c'),      sectionId);
            opp.put(NamespaceUtils.withNamespace('Academic_Year__c'), studentData.get('academicYear'));
            if (!Schema.sObjectType.Opportunity.isCreateable()) {
                throw new AuraHandledException('Insufficient permissions to create opportunities.');
            }
            SObjectAccessDecision decisionOpp = Security.stripInaccessible(AccessType.CREATABLE, new List<Opportunity>{opp});
            insert decisionOpp.getRecords();
            opp = (Opportunity) decisionOpp.getRecords()[0];

            if (!selectedPricebookEntryIds.isEmpty()) {
                List<PricebookEntry> pbes = [SELECT Id, UnitPrice FROM PricebookEntry WHERE Id IN :selectedPricebookEntryIds WITH SECURITY_ENFORCED];
                Decimal totalAmount = 0;
                for (PricebookEntry pbe : pbes) totalAmount += pbe.UnitPrice;

                Decimal discountPercent = 0;
                if (totalAmount > 0 && concessionAmount > 0) {
                    discountPercent = (concessionAmount / totalAmount) * 100;
                    if (discountPercent > 100) {
                        discountPercent = 100;
                    }
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
                if (!Schema.sObjectType.OpportunityLineItem.isCreateable()) {
                    throw new AuraHandledException('Insufficient permissions to create opportunity line items.');
                }
                SObjectAccessDecision decisionOlis = Security.stripInaccessible(AccessType.CREATABLE, olis);
                insert decisionOlis.getRecords();
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

    @AuraEnabled
    public static List<Map<String, String>> getAcademicYearOptions() {
        List<Map<String, String>> options = new List<Map<String, String>>();
        for (Academic_Year__c ay : [SELECT Id, Name FROM Academic_Year__c WHERE Is_Active__c = true WITH SECURITY_ENFORCED ORDER BY Start_Date__c ASC LIMIT 100]) {
            options.add(new Map<String, String>{ 'label' => ay.Name, 'value' => ay.Id });
        }
        return options;
    }

    @AuraEnabled
    public static List<Map<String, String>> getClassOptions() {
        List<Map<String, String>> options = new List<Map<String, String>>();
        try {
            for (Class__c cls : [SELECT Id, Name FROM Class__c WITH SECURITY_ENFORCED ORDER BY Name ASC LIMIT 500]) {
                options.add(new Map<String, String>{ 'label' => cls.Name, 'value' => cls.Id });
            }
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching classes: ' + e.getMessage());
        }
        return options;
    }

    @AuraEnabled
    public static List<Map<String, String>> getSectionOptions(String classId) {
        List<Map<String, String>> options = new List<Map<String, String>>();
        for (Section__c sec : [SELECT Id, Name FROM Section__c WITH SECURITY_ENFORCED ORDER BY Name ASC LIMIT 500]) {
            options.add(new Map<String, String>{ 'label' => sec.Name, 'value' => sec.Id });
        }
        return options;
    }

    public class StudentSearchResult {
        @AuraEnabled public Map<String, Object> account { get; set; }
        @AuraEnabled public Decimal totalPendingBalance { get; set; }
        @AuraEnabled public Decimal totalPaidAmount     { get; set; }
        public StudentSearchResult(Map<String, Object> acc, Decimal balance, Decimal paid) {
            this.account = acc;
            this.totalPendingBalance = balance;
            this.totalPaidAmount = paid;
        }
    }

    @AuraEnabled
    public static List<StudentSearchResult> searchStudents(String searchTerm, Double timestamp) {
        String query = '%' + searchTerm + '%';
        List<Account> accounts = (List<Account>)Security.stripInaccessible(AccessType.READABLE, [
            SELECT Id, Name, PersonMobilePhone, Class__c, Section__c,
                   Class__r.Name, Section__r.Name,
                   (SELECT Id, Academic_Year__c FROM Opportunities WHERE IsClosed = false ORDER BY CreatedDate DESC)
            FROM Account
            WHERE IsPersonAccount = true
            AND (Name LIKE :query OR PersonMobilePhone LIKE :query)
            LIMIT 20
        ]).getRecords();
        Set<Id> accIds = new Set<Id>();
        for (Account acc : accounts) accIds.add(acc.Id);

        Map<Id, Decimal> accountToTotalFee = new Map<Id, Decimal>();
        for (AggregateResult ar : [SELECT Opportunity.AccountId accId, SUM(TotalPrice) total FROM OpportunityLineItem WHERE Opportunity.AccountId IN :accIds AND Opportunity.IsClosed = false WITH SECURITY_ENFORCED GROUP BY Opportunity.AccountId]) {
            accountToTotalFee.put((Id)ar.get('accId'), (Decimal)ar.get('total'));
        }

        Map<Id, Decimal> accountToTotalPaid = new Map<Id, Decimal>();
        for (AggregateResult ar : [SELECT Invoice__r.Student__c studentId, SUM(Amount__c) total FROM Invoice_Item__c WHERE Invoice__r.Student__c IN :accIds AND Invoice__r.Opportunity__r.IsClosed = false AND Invoice__r.Status__c != 'Cancelled' WITH SECURITY_ENFORCED GROUP BY Invoice__r.Student__c]) {
            accountToTotalPaid.put((Id)ar.get('studentId'), (Decimal)ar.get('total'));
        }

        List<StudentSearchResult> results = new List<StudentSearchResult>();
        for (Account acc : accounts) {
            Decimal total = accountToTotalFee.containsKey(acc.Id)  ? accountToTotalFee.get(acc.Id)  : 0;
            Decimal paid  = accountToTotalPaid.containsKey(acc.Id) ? accountToTotalPaid.get(acc.Id) : 0;
            Map<String, Object> accMap = NamespaceUtils.stripNamespace(acc);
            if (acc.Opportunities != null && !acc.Opportunities.isEmpty()) {
                accMap.put('Opportunities', NamespaceUtils.stripNamespaceList(acc.Opportunities));
            }
            results.add(new StudentSearchResult(accMap, total - paid, paid));
        }

        return results;
    }

    @AuraEnabled
    public static StudentSearchResult getStudentById(Id studentId, Double timestamp) {
        List<Account> accounts = (List<Account>)Security.stripInaccessible(AccessType.READABLE, [
            SELECT Id, Name, PersonMobilePhone, Class__c, Section__c,
                   Class__r.Name, Section__r.Name,
                   (SELECT Id, Academic_Year__c FROM Opportunities WHERE IsClosed = false ORDER BY CreatedDate DESC)
            FROM Account WHERE Id = :studentId LIMIT 1
        ]).getRecords();
        if (accounts.isEmpty()) throw new AuraHandledException('Student not found.');
        Account acc = accounts[0];
        Decimal total = 0;
        List<AggregateResult> feeRes = [SELECT SUM(TotalPrice) total FROM OpportunityLineItem WHERE Opportunity.AccountId = :studentId AND Opportunity.IsClosed = false WITH SECURITY_ENFORCED];
        if (!feeRes.isEmpty() && feeRes[0].get('total') != null) {
            total = (Decimal)feeRes[0].get('total');
        }
        Decimal paid = 0;
        List<AggregateResult> paidRes = [SELECT SUM(Amount__c) total FROM Invoice_Item__c WHERE Invoice__r.Student__c = :studentId AND Invoice__r.Opportunity__r.IsClosed = false AND Invoice__r.Status__c != 'Cancelled' WITH SECURITY_ENFORCED];
        if (!paidRes.isEmpty() && paidRes[0].get('total') != null) {
            paid = (Decimal)paidRes[0].get('total');
        }
        Map<String, Object> accMap = NamespaceUtils.stripNamespace(acc);
        // Explicitly ensure Opportunities relationship is present and stripped
        if (acc.Opportunities != null && !acc.Opportunities.isEmpty()) {
            accMap.put('Opportunities', NamespaceUtils.stripNamespaceList(acc.Opportunities));
        }
        
        return new StudentSearchResult(accMap, total - paid, paid);
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
            this.productName     = oli.Product2 != null ? oli.Product2.Name : 'Unknown';
            
            Decimal unitPriceValue = (Decimal)NamespaceUtils.getValue(oli, 'UnitPrice');
            this.totalAmount     = unitPriceValue != null ? unitPriceValue : 0;
            
            Decimal disc = (Decimal)NamespaceUtils.getValue(oli, 'Discount');
            this.discountPercent = disc != null ? disc : 0;
            
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
        List<Invoice_Item__c> items = (List<Invoice_Item__c>)Security.stripInaccessible(AccessType.READABLE, [
            SELECT Opportunity_Line_Item_Id__c, Amount__c
            FROM Invoice_Item__c
            WHERE Invoice__r.Opportunity__c = :opportunityId AND Invoice__r.Status__c != 'Cancelled'
            LIMIT 1000
        ]).getRecords();
        for (Invoice_Item__c item : items) {
            String oliId  = (String)NamespaceUtils.getValue(item, 'Opportunity_Line_Item_Id__c');
            if (oliId == null) continue; // Skip if stripped
            Decimal current = oliToPaidAmount.containsKey(oliId) ? oliToPaidAmount.get(oliId) : 0;
            oliToPaidAmount.put(oliId, current + (item.Amount__c != null ? item.Amount__c : 0));
        }
        List<FeeWrapper> results = new List<FeeWrapper>();
        List<OpportunityLineItem> olis = (List<OpportunityLineItem>)Security.stripInaccessible(AccessType.READABLE, [
            SELECT Id, Product2Id, Product2.Name, UnitPrice, Discount, TotalPrice
            FROM OpportunityLineItem WHERE OpportunityId = :opportunityId
            LIMIT 500
        ]).getRecords();
        for (OpportunityLineItem oli : olis) {
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
            if (!Schema.sObjectType.Invoice__c.isCreateable()) {
                throw new AuraHandledException('Insufficient permissions to create invoices.');
            }
            SObjectAccessDecision decision = Security.stripInaccessible(AccessType.CREATABLE, new List<Invoice__c>{inv});
            insert decision.getRecords();
            inv = (Invoice__c) decision.getRecords()[0];

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
            if (!Schema.sObjectType.Invoice_Item__c.isCreateable()) {
                throw new AuraHandledException('Insufficient permissions to create invoice items.');
            }
            SObjectAccessDecision decisionItems = Security.stripInaccessible(AccessType.CREATABLE, items);
            insert decisionItems.getRecords();
            return inv.Id;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    public class InvoiceWrapper {
        @AuraEnabled public String  id           { get; set; }
        @AuraEnabled public String  name         { get; set; }
        @AuraEnabled public String  dateStr      { get; set; }
        @AuraEnabled public String  status       { get; set; }
        @AuraEnabled public String  totalAmount  { get; set; }
        public InvoiceWrapper(Invoice__c inv) {
            this.id = inv.Name; 
            this.name = inv.Student__r != null ? inv.Student__r.Name : inv.Name; 
            this.dateStr = inv.Invoice_Date__c != null ? inv.Invoice_Date__c.format() : '';
            this.status = inv.Status__c; 
            // Use the roll-up field Total_Paid_in_this_Invoice__c which accurately sums the items
            this.totalAmount = (inv.Total_Paid_in_this_Invoice__c != null ? inv.Total_Paid_in_this_Invoice__c.setScale(2).toPlainString() : '0.00');
        }
    }

    @AuraEnabled
    public static List<InvoiceWrapper> getRecentInvoices(Id studentId) {
        List<InvoiceWrapper> results = new List<InvoiceWrapper>();
        for (Invoice__c inv : [
            SELECT Id, Name, Status__c, Total_Paid_in_this_Invoice__c, Invoice_Date__c, Student__r.Name
            FROM Invoice__c 
            WHERE Student__c = :studentId AND Status__c != 'Cancelled'
            WITH SECURITY_ENFORCED
            ORDER BY CreatedDate DESC LIMIT 5
        ]) {
            results.add(new InvoiceWrapper(inv));
        }
        return results;
    }

    @AuraEnabled
    public static void voidInvoice(Id invoiceId) {
        try {
            Invoice__c inv = [SELECT Id, Status__c FROM Invoice__c WHERE Id = :invoiceId WITH SECURITY_ENFORCED LIMIT 1];
            inv.Status__c = 'Cancelled';
            SObjectAccessDecision decision = Security.stripInaccessible(AccessType.UPDATABLE, new List<Invoice__c>{inv});
            update decision.getRecords();
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
            OpportunityLineItem oli = [SELECT Id, Discount FROM OpportunityLineItem WHERE Id = :oliId WITH SECURITY_ENFORCED LIMIT 1];
            oli.Discount = discountPercent; 
            SObjectAccessDecision decision = Security.stripInaccessible(AccessType.UPDATABLE, new List<OpportunityLineItem>{oli});
            update decision.getRecords();
        } catch (Exception e) {
            throw new AuraHandledException('Error updating concession: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void updateBulkLineItemDiscounts(List<String> oliIds, Decimal discountPercent) {
        try {
            List<OpportunityLineItem> olisToUpdate = [SELECT Id, Discount FROM OpportunityLineItem WHERE Id IN :oliIds WITH SECURITY_ENFORCED LIMIT 500];
            for (OpportunityLineItem oli : olisToUpdate) {
                oli.Discount = discountPercent;
            }
            if (!olisToUpdate.isEmpty()) {
                SObjectAccessDecision decision = Security.stripInaccessible(AccessType.UPDATABLE, olisToUpdate);
                update decision.getRecords();
            }
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
            List<RecordType> rts = (List<RecordType>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id FROM RecordType WHERE SobjectType='Account' AND IsPersonType=true LIMIT 1]).getRecords();
            if (rts.isEmpty()) throw new AuraHandledException('Person Account Record Type not found.');
            Id personAccountRecordTypeId = rts[0].Id;

            // ── Academic Year name → Id map ──────────────────────────────────────────
            Map<String, Id> ayMap = new Map<String, Id>();
            for (Academic_Year__c ay : [SELECT Id, Name FROM Academic_Year__c WITH SECURITY_ENFORCED LIMIT 100]) {
                if (ay.Name != null) {
                    ayMap.put(ay.Name.replaceAll('–', '-'), ay.Id);
                }
            }

            // ── ✅ Class name → Id map (lookup resolution) ────────────────────────────
            Map<String, Id> classNameToId = new Map<String, Id>();
            for (Class__c cls : [SELECT Id, Name FROM Class__c WITH SECURITY_ENFORCED LIMIT 500]) {
                if (cls.Name != null) {
                    classNameToId.put(cls.Name.toLowerCase().trim(), cls.Id);
                }
            }

            // ── ✅ Section name → Id map (lookup resolution) ──────────────────────────
            Map<String, Id> sectionNameToId = new Map<String, Id>();
            for (Section__c sec : [SELECT Id, Name FROM Section__c WITH SECURITY_ENFORCED LIMIT 1000]) {
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
            List<PricebookEntry> allPbes = (List<PricebookEntry>)Security.stripInaccessible(AccessType.READABLE, [
                SELECT Id, Product2Id, Product2.Name, UnitPrice, Pricebook2Id,
                       Pricebook2.Name, Pricebook2.Academic_Year__c
                FROM PricebookEntry
                WHERE IsActive = true
                AND Pricebook2.IsActive = true
                AND Product2.ProductCode != 'PREV_DUES'
                AND (NOT Product2.Name LIKE '%Previous%')
                AND Pricebook2.Name LIKE 'Class %'
                LIMIT 2000
            ]).getRecords();

            for (PricebookEntry pbe : allPbes) {
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
                    acc.put(NamespaceUtils.withNamespace('Father_Name__c'), data.get('Father Name'));
                    acc.put(NamespaceUtils.withNamespace('Mother_Name__c'), data.get('Mother Name'));

                    String dobStr = data.containsKey('DOB') ? data.get('DOB') : data.get('DOB (YYYY-MM-DD)');
                    if (String.isNotBlank(dobStr)) acc.PersonBirthdate = parseFlexibleDate(dobStr);

                    acc.put(NamespaceUtils.withNamespace('Aadhar_Card_No__c'), data.get('Aadhar No'));
                    acc.put(NamespaceUtils.withNamespace('Village__c'), data.get('Village'));
                    acc.PersonMailingCity       = data.get('City');
                    acc.PersonMailingPostalCode = data.get('Pincode');
                    acc.put(NamespaceUtils.withNamespace('State__c'),   data.get('State'));
                    acc.put(NamespaceUtils.withNamespace('Country__c'), data.get('Country'));
                    acc.Type = 'Student';

                    acc.put(NamespaceUtils.withNamespace('Active__c'), 'Yes');
                    acc.put(NamespaceUtils.withNamespace('Class__c'),   classId);
                    acc.put(NamespaceUtils.withNamespace('Section__c'), sectionId);

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
                SObjectAccessDecision decisionAcc = Security.stripInaccessible(AccessType.CREATABLE, accountsToInsert);
                Database.SaveResult[] srList = Database.insert(decisionAcc.getRecords());

                List<Opportunity>        oppsToInsert    = new List<Opportunity>();
                List<Map<String, String>> successRowData  = new List<Map<String, String>>();
                List<Account>            successAccounts = new List<Account>();

                for (Integer i = 0; i < srList.size(); i++) {
                    if (srList[i].isSuccess()) {
                        Account acc              = (Account) decisionAcc.getRecords()[i];
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
                        opp.put(NamespaceUtils.withNamespace('Class__c'),        classId);
                        opp.put(NamespaceUtils.withNamespace('Section__c'),      sectionId);
                        opp.put(NamespaceUtils.withNamespace('Academic_Year__c'), ayId);

                        oppsToInsert.add(opp);
                        successRowData.add(data);
                        successAccounts.add(acc);
                    } else {
                        errors.add('Row account error: ' + srList[i].getErrors()[0].getMessage());
                    }
                }

                // ── Insert Opportunities ──────────────────────────────────────────────
                if (!oppsToInsert.isEmpty()) {
                    SObjectAccessDecision decisionOpp = Security.stripInaccessible(AccessType.CREATABLE, oppsToInsert);
                    Database.SaveResult[] srOppList = Database.insert(decisionOpp.getRecords());
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
                        SObjectAccessDecision decisionOlis = Security.stripInaccessible(AccessType.CREATABLE, olisToInsert);
                        insert decisionOlis.getRecords();
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
            } catch (Exception ex) {
                // Individual date format parsing failed; ignore and try next format
                System.debug('AdmissionController: Date parsing failed for format chain: ' + ex.getMessage());
            }
        }
        throw new IllegalArgumentException('Invalid date: ' + dateStr + '. Expected YYYY-MM-DD or DD-MM-YYYY.');
    }
}




