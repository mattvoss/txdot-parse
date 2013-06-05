var CreditPaymentView = Backbone.View.extend({
    events: {
        "click .pay-now"       :   "makePayment"
    },

    initialize: function(opts) {
        _.bindAll(this, 'render', 'renderErrors', 'makePayment', 'makePaymentOnEnter', 'renderPaymentForm', 'shown');
        //this.genEvent = App.Models.events.where({reg_type: "general", member: 1})[0];
        this.validCard = false;
        this.currentYear = new Date().getFullYear();
        this.years = [{ val: 'error', label: 'Select a year'}, { val: this.currentYear, label: this.currentYear }];
        for (var i=1;i<=10;i++) {
            this.years.push({ val: this.currentYear + i, label: this.currentYear + i });
        }
        this.months = [
            { val: 'error', label: 'Select a month'},
            { val: 1, label: '01 Jan' },
            { val: 2, label: '02 Feb' },
            { val: 3, label: '03 Mar' },
            { val: 4, label: '04 Apr' },
            { val: 5, label: '05 May' },
            { val: 6, label: '06 Jun' },
            { val: 7, label: '07 Jul' },
            { val: 8, label: '08 Aug' },
            { val: 9, label: '09 Sep' },
            { val: 10, label: '10 Oct' },
            { val: 11, label: '11 Nov' },
            { val: 12, label: '12 Dec' }
        ];
        this.creditCards = {
            "visa": "v",
            "mastercard": "m",
            "discover": "d",
            "amex": "a"
        };
    },

    render: function() {
        var source      = Templates.acceptPayment,
            template    = Handlebars.compile(source),
            html        = template(),
            vars        = this.model.attributes,
            view        = this;

        this.$el.html(html);
        this.renderPaymentForm();
        $(".payment", this.$el).button();
        $('#app').append(this.el);
        return this;
    },

    unrender: function() {
        console.log('Kill: ', this.cid);

        this.trigger('close:all');
        this.unbind(); // Unbind all local event bindings
        //this.collection.unbind( 'change', this.render, this ); // Unbind reference to the model
        //this.collection.unbind( 'reset', this.render, this ); // Unbind reference to the model
        //this.options.parent.unbind( 'close:all', this.close, this ); // Unbind reference to the parent view

        this.remove(); // Remove view from DOM

        delete this.$el; // Delete the jQuery wrapped object variable
        delete this.el; // Delete the variable reference to this node
    },

    renderPaymentForm: function() {
        var view = this;
        this.form1 = new Backbone.Form({
            schema: {
                fullName: {type: "Text", title:"Card Holder's Name"},
                address: {type: "Text", title:"Street Address"},
                city: {type: "Text", title:"City"},
                state: {type: "Select", title:"State", options: States},
                zip: {type: "Text", title:"Zip"},
                email: {type: "Text", title:"Email"}
            },
            data: {
                fullName: this.model.get("firstname") + " " + this.model.get("lastname"),
                address: this.model.get("address1"),
                city: this.model.get("city"),
                state: this.model.get("state_province"),
                zip: this.model.get("zipcode"),
                email: this.model.get("email")
            }
        }).render();

        this.form2 = new Backbone.Form({
            schema: {
                cardNumber: {
                    type: "Text",
                    title:"Card Number",
                    validators: [
                        function checkCardNum(value, formValues) {
                            var err = {
                                type: 'cardNumber',
                                message: 'A valid credit card number must be entered'
                            };

                            if (!this.validCard) return err;
                        }
                    ]
                }
            },
            data: {

            }
        }).render();

        this.form3 = new Backbone.Form({
            schema: {
                expirationMonth: {
                    type: "Select",
                    options: this.months,
                    title: "Expiration Month",
                    validators: [
                        function checkExpM(value, formValues) {
                            var err = {
                                type: 'expirationMonth',
                                message: 'Expiration month must be entered'
                            };

                            if (value == "error") return err;
                        }
                    ]
                },
                expirationYear: {
                    type: "Select",
                    options: this.years,
                    title: "Expiration Year",
                    validators: [
                        function checkExpY(value, formValues) {
                            var err = {
                                type: 'expirationYear',
                                message: 'Expiration year must be entered'
                            };

                            if (value == "error") return err;
                        }
                    ]
                },
                cardCode: {
                    type: "Text",
                    title:"Card Security Number",
                    validators: [
                        function checkSecCode(value, formValues) {
                            var err = {
                                type: 'cardCode',
                                message: 'Card security number must be entered'
                            };

                            if (value.length == 0) return err;
                        }
                    ]
                },
                amount: {
                    type:"Text",
                    title:"Amount to be charged",
                    editorAttrs: { disabled: true },
                    validators: [
                        function checkAmount(value, formValues) {
                            var err = {
                                type: 'amount',
                                message: 'Amount must be greater than $0.00'
                            };

                            if (value == "0.00") return err;
                        }
                    ]
                }
            },
            data: {
                amount: this.model.get("total_price") || "0.00"
            }
        }).render();

        $(".paymentControls1", this.$el).append(this.form1.$el);
        $(".paymentControls2 .cn-control", this.$el).html(this.form2.$el);
        $(".paymentControls2 .other-credit-controls", this.$el).html(this.form3.$el);
        //$("#creditCardTypes", this.$el).show();

        $("#cardNumber", this.$el).validateCreditCard(function(result){
            if (result.luhn_valid) {
                this.validCard = true;
                console.log('CC type: ' + result.card_type.name
                  + '\nLength validation: ' + result.length_valid
                  + '\nLuhn validation:' + result.luhn_valid);

                $("#mc", this.$el).toggleClass("mb").toggleClass("mc");
                $("#vc", this.$el).toggleClass("vb").toggleClass("vc");
                $("#dc", this.$el).toggleClass("db").toggleClass("dc");
                $("#ac", this.$el).toggleClass("ab").toggleClass("ac");
                var active = view.creditCards[result.card_type.name]+"c",
                    inactive = view.creditCards[result.card_type.name]+"b";
                $("#"+active, this.$el).addClass(active).removeClass(inactive);
            } else {
                this.validCard = false;
                $("#mc", this.$el).removeClass("mb").addClass("mc");
                $("#vc", this.$el).removeClass("vb").addClass("vc");
                $("#dc", this.$el).removeClass("db").addClass("dc");
                $("#ac", this.$el).removeClass("ab").addClass("ac");
            }
        });
    },

    renderCheck: function() {
        var view = this;
        this.form = new Backbone.Form({
            schema: {
                amount: {type:"Number", title:"Amount to be charged"},
                checkNumber: {type: "Text", title:"Check Number"}
            }
        }).render();

        $(".paymentControls", this.$el).html(this.form.$el);
        $("#creditCardTypes", this.$el).hide();
    },

    shown: function(e) {
        $("#swipe", this.$el).focus();
    },

    makePaymentOnEnter: function(e) {
        if (e.keyCode != 13) return;
        e.stopImmediatePropagation();
        //this.makePayment(e);
    },

    renderErrors: function(trans) {
        var source      = Templates.warning,
            template    = Handlebars.compile(source),
            transaction = {},
            view        = this;

        if (typeof trans.errors == "object") {
            transaction.errors = [trans.errors.error];
        } else if (trans.responseCode == 2) {
            transaction.errors = [{
                "errorText": trans.responseReasonDescription
            }];
        }

        var html = template(transaction);
        $('#app').prepend(html);
    },

    makePayment: function(e) {
        if (!this.form1.validate() && !this.form2.validate() && !this.form3.validate()) {
            var view = this,
                values = _.extend(this.form1.getValue(), this.form2.getValue(), this.form3.getValue()),
                type = "credit",
                transaction = {
                    "transactionType": "authCaptureTransaction",
                    "amount": values.amount.replace("$",""),
                    "payment": {}
                },
                creditCard = {
                    "creditCard" : {
                        "cardNumber": values.cardNumber,
                        "expirationDate": values.expirationMonth+"/"+values.expirationYear,
                        "cardCode": values.cardCode
                    }
                },
                name = values.fullName.split(" ");
            transaction.payment = _.extend(
                transaction.payment,
                creditCard
            );
            var firstname = name[0],
                lastname = "";
            if (name.length > 2) {
                lastname = name[2];
            } else {
                lastname = name[1];
            }

            var orderInfo =  {
                "order": {
                    "invoiceNumber": "VPPPA-MAPP-"+this.model.get("counter")
                },
                "customer": {
                    "email": "voss.matthew@gmail.com" //values.email
                },
                "billTo":{},
                "shipTo":{}
            };
            transaction = _.extend(
                transaction,
                orderInfo
            );
            transaction.shipTo.firstName = transaction.billTo.firstName = firstname;
            transaction.shipTo.lastName = transaction.billTo.lastName = lastname;
            var address = {
                "address": values.address || this.model.get("address1"),
                "city": values.city || this.model.get("city"),
                "state": values.state || this.model.get("state_province"),
                "zip": values.zip || this.model.get("zipcode")
            };

            transaction.shipTo = _.extend(
                transaction.shipTo,
                address
            );

            transaction.billTo = _.extend(
                transaction.billTo,
                address
            );

            this.model.set({transaction:transaction, type: type});
            this.model.save({}, {success: function(model, response, options) {
                console.log(response);
                if ("code" in response) {
                    if ("transactionResponse" in response) {
                        //view.parent.errors = response.transactionResponse.errors;
                        view.renderErrors(response.transactionResponse);
                    }
                } else if (response.creditResult.transaction.responseCode == 2) {
                    //view.parent.errors = response.creditResult.transaction.errors;
                    view.renderErrors(response.creditResult.transaction);
                } else {
                    //view.unrender();
                    App.Router.navigate("receipt/"+model.id, true);
                }
            }});
        }
    }

});
