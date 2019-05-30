/*
 * Copyright © 2019 Cask Data, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

import * as React from 'react';
import Input from '@material-ui/core/Input';
import withStyles from '@material-ui/core/styles/withStyles';

import AbstractRow, {
  IAbstractRowProps,
  IAbstractRowState,
} from 'components/AbstractWidget/AbstractMultiRowWidget/AbstractRow';

const styles = (theme) => {
  return {
    root: {
      height: '44px',
    },
    input: {
      width: 'calc(100% - 100px)',
      'margin-right': '10px',
    },
    disabled: {
      color: `${theme.palette.grey['50']}`,
    },
  };
};

interface ICSVRowProps extends IAbstractRowProps<typeof styles> {
  valuePlaceholder?: string;
}

class CSVRow extends AbstractRow<ICSVRowProps, IAbstractRowState> {
  public static defaultProps = {
    valuePlaceholder: 'Value',
  };

  public renderInput = () => {
    return (
      <Input
        id={`multi-row-${this.props.id}`}
        className={this.props.classes.input}
        classes={{ disabled: this.props.classes.disabled }}
        placeholder={this.props.valuePlaceholder}
        onChange={this.onChange}
        value={this.state.value}
        autoFocus={this.props.autofocus}
        onKeyPress={this.handleKeyPress}
        onKeyDown={this.handleKeyDown}
        disabled={this.props.disabled}
      />
    );
  };
}

const StyledCSVRow = withStyles(styles)(CSVRow);
export default StyledCSVRow;
