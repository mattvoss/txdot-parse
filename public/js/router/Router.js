var Router = Backbone.Router.extend({

    routes: {
        ""                          :   "index",
        "credit/:submissionId"      :   "creditPayment",
        "payment/:submissionId"     :   "paymentOptions",
        "receipt/:submissionId"     :   "receipt",
        "dash"                      :   "dash"
    },

    views: {},

    initialize: function() {
        _.bindAll(this, 'index',  'creditPayment', 'paymentOptions', 'dash', 'setBody');

        //Create all the views, but don't render them on screen until needed
        this.views.app = new AppView({ el: $('body') });
        //this.views.tags = new TagsView();
        //this.views.account = new AccountView();

        //The "app view" is the layout, containing the header and footer, for the app
        //The body area is rendered by other views
        this.view = this.views.app;
        this.view.render();
        this.currentView = null;
    },

    index: function() {
        //if the user is logged in, show their documents, otherwise show the signup form
        this.navigate("dash", true);
        /**
        this.views.dash = new DashboardView();
        App.Io.emit('ready', {'user': App.uid});
        this.setBody(this.views.dash, true);
        this.view.body.render();
        **/
    },

    creditPayment: function(submissionId) {
        var router = this;
        App.Models.member = new Member({id: submissionId});
        App.Models.member.fetch({success: function(model, response, options) {
            var view = new CreditPaymentView({ model: App.Models.member });
            router.setBody(view, true);
            router.view.body.render();
        }});
    },

    paymentOptions: function(submissionId) {
        var router = this;
        App.Models.member = new Member({id: submissionId});
        App.Models.member.fetch({success: function(model, response, options) {

            if (App.Models.member.attributes.creditCardTrans.length > 0) {
                var trans = App.Models.member.get("creditCardTrans"),
                    total = 0;
                trans.forEach(function(transaction, index) {
                    total += parseFloat(transaction.settleAmount);
                });

                if (total >= parseFloat(App.Models.member.get("total_price").replace("$",""))) {
                    App.Router.navigate("receipt/"+App.Models.member.id, true);
                } else {
                    var view = new PaymentOptionsView({ model: App.Models.member });
                    router.setBody(view, true);
                    router.view.body.render();
                }
            } else {
                var view = new PaymentOptionsView({ model: App.Models.member });
                router.setBody(view, true);
                router.view.body.render();
            }
        }});
    },

    receipt: function(submissionId) {
        var router = this;
        App.Models.member = new Member({id: submissionId});
        App.Models.member.fetch({success: function(model, response, options) {
            var view = new ReceiptView({ model: App.Models.member });
            router.setBody(view, true);
            router.view.body.render();
        }});
    },

    dash: function() {
        this.views.dash = new DashboardView();
        App.Io.emit('ready', {'user': App.uid});
        this.setBody(this.views.dash, true);
        this.view.body.render();
    },

    setBody: function(view, auth) {
        /**
        if (auth == true && typeof App.user == 'undefined') {
            this.navigate("", true);
            return;
        }
        **/
        if (typeof this.view.body != 'undefined') {
            this.view.body.unrender();
        }
        App.CurrentView = view;
        this.view.body = view;
    }

});
