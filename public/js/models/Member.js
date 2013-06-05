var Member = Backbone.Model.extend({
    idAttribute: "id",
    defaults: {
        url: 'http://'
    },
    url: function() {
        return Config.prefix+"/api/member/" + this.id;
    },
    set: function(attributes, options) {
        var ret = Backbone.Model.prototype.set.call(this, attributes, options);
        this.payment = nestCollection(this, 'payment', new Payments(this.get('payment')));
        return ret;
    },
    validate: function(attrs) {
        var errs = {};

        if (attrs.amount == "0.00") {
            errs.amount = 'Amount cannot be $0.00';
        }

        if (!_.isEmpty(errs)) return errs;
    }
});
