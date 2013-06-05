var PaymentOptionsView = Backbone.View.extend({
    events: {
        "click .invoice"        :   "displayInvoice",
        "click .credit"         :   "displayCreditPayment"
    },

    initialize: function() {
        _.bindAll(this, 'render', 'unrender', 'displayInvoice', 'displayCreditPayment');

        //this.options.parent.on('close:all', this.unrender, this); // Event listener on parent

    },

    render: function() {
        var source      = Templates.paymentOptions,
            template    = Handlebars.compile(source),
            vars        = this.model.attributes,
            html        = template(vars),
            self        = this;

        this.$el.html(html);
        $('#app').append(this.el);
    },

    unrender: function () {

        console.log('Kill: ', this.cid);

        this.trigger('close:all');
        this.unbind(); // Unbind all local event bindings
        //this.options.parent.unbind( 'close:all', this.close, this ); // Unbind reference to the parent view

        this.remove(); // Remove view from DOM

        delete this.$el; // Delete the jQuery wrapped object variable
        delete this.el; // Delete the variable reference to this node

    },

    displayInvoice: function(e) {
        App.Router.navigate("receipt/"+this.model.id, true);
    },

    displayCreditPayment: function(e) {
        App.Router.navigate("credit/"+this.model.id, true);
    }

});
