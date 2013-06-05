var UploadView = Backbone.View.extend({
    events: {
        "click .invoice"        :   "displayInvoice",
        "click .credit"         :   "displayCreditPayment"
    },

    initialize: function() {
        _.bindAll(this, 'render', 'unrender');

        //this.options.parent.on('close:all', this.unrender, this); // Event listener on parent

    },

    render: function() {
        var source      = Templates.uploadFile,
            template    = Handlebars.compile(source),
            html        = template(),
            view        = this;

        this.$el.html(html);
        $('#app').append(this.el);

        $('#fileupload', this.$el).fileupload({
            url: "/uploadFile",
            dataType: 'json',
            start: function (e, data) {
                $('#progress .bar').css(
                    'width',
                   '0%'
                );
            },
            done: function (e, data) {
                $.each(data.result.files, function (index, file) {
                    var index = file.path.lastIndexOf("/") + 1,
                        fileId = file.path.substr(index).split(".");
                    $('<p/>').html("<strong>"+file.name + "</strong>: <a target='_blank' href='/downloadFile/"+fileId[0]+"'>Download CSV</a>").appendTo('#files');
                });
            },
            progressall: function (e, data) {
                var progress = parseInt(data.loaded / data.total * 100, 10);
                $('#progress .bar').css(
                    'width',
                    progress + '%'
                );
            }
        });

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
