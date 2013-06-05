var ReceiptView = Backbone.View.extend({
    events: {

    },

    initialize: function(opts) {
        _.bindAll(this, 'render', 'unrender');

    },

    render: function() {
        var source      = Templates.receipt,
            template    = Handlebars.compile(source),
            vars        = this.model.attributes,
            view        = this;
        var html = template(vars);
        this.$el.html(html);
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


});
