var AppView = Backbone.View.extend({

    events: {
        "click  #btn-home":            "home"
    },

    initialize: function() {
        _.bindAll(this, 'render', 'home');
        this.currentRegistrant = {};
    },

    render: function() {
         var source = Templates.header,
            template = Handlebars.compile(source),
            html = template();
         $('#header').html(html);
    },

    home: function(e) {
        e.preventDefault();
        App.Router.navigate("", true);
    }

});
