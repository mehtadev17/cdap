package com.continuuity.explore.jdbc;

import com.continuuity.explore.client.ExploreClientUtil;
import com.continuuity.explore.service.Explore;
import com.continuuity.explore.service.ExploreException;
import com.continuuity.explore.service.Handle;
import com.continuuity.explore.service.HandleNotFoundException;
import com.continuuity.explore.service.Status;

import com.google.common.base.Throwables;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.SQLWarning;
import java.sql.Statement;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Explore JDBC statement.
 */
public class ExploreStatement implements Statement {
  private static final Logger LOG = LoggerFactory.getLogger(ExploreStatement.class);
  private static final int MAX_POLL_TRIES = 1000000;

  private int fetchSize = 50;

  /**
   * We need to keep a reference to the result set to support the following:
   * <code>
   *  statement.execute(String sql);
   *  statement.getResultSet();
   * </code>.
   */
  private ResultSet resultSet = null;

  /**
   * Sets the limit for the maximum number of rows that any ResultSet object produced by this
   * Statement can contain to the given number. If the limit is exceeded, the excess rows
   * are silently dropped. The value must be >= 0, and 0 means there is not limit.
   */
  // TODO pass it to the result set
  private int maxRows = 0;

  private boolean isClosed = false;

  private Handle stmtHandle = null;

  private ReentrantLock clientLock = new ReentrantLock(true);

  private final Connection connection;
  private final Explore exploreClient;

  public ExploreStatement(Connection connection, Explore exploreClient) {
    this.connection = connection;
    this.exploreClient = exploreClient;
  }

  @Override
  public ResultSet executeQuery(String sql) throws SQLException {
    if (!execute(sql)) {
      throw new SQLException("The query did not generate a result set!");
    }
    return resultSet;
  }

  /*
   * Executes a query and wait until it is finished, but does not close the session.
   */
  @Override
  public boolean execute(String sql) throws SQLException {
    if (isClosed) {
      throw new SQLException("Can't execute after statement has been closed");
    }

    // TODO in future, the polling logic should be in another SyncExploreClient
    try {
      try {
        clientLock.lock();
        stmtHandle = exploreClient.execute(sql);
      } finally {
        clientLock.unlock();
      }
      // We don't care about passing the lock for getting status
      Status status = ExploreClientUtil.waitForCompletionStatus(exploreClient, stmtHandle, 200,
                                                                TimeUnit.MILLISECONDS, MAX_POLL_TRIES);

      if (status.getStatus() != Status.OpStatus.FINISHED && status.getStatus() != Status.OpStatus.CANCELED) {
        throw new SQLException(String.format("Statement '%s' execution did not finish successfully. " +
                                             "Got final state - %s", sql, status.getStatus().toString()));
      }
      resultSet = new ExploreQueryResultSet(exploreClient, this, stmtHandle);
      return status.hasResults();
    } catch (HandleNotFoundException e) {
      // Cannot happen unless explore server restarted.
      LOG.error("Error running enable explore", e);
      throw Throwables.propagate(e);
    } catch (InterruptedException e) {
      LOG.error("Caught exception", e);
      Thread.currentThread().interrupt();
      // TODO is this the correct behavior?
      return false;
    } catch (ExploreException e) {
      LOG.error("Caught exception", e);
      throw new SQLException(e);
    }
  }

  @Override
  public ResultSet getResultSet() throws SQLException {
    return resultSet;
  }

  @Override
  public int getMaxRows() throws SQLException {
    return maxRows;
  }

  @Override
  public void setMaxRows(int max) throws SQLException {
    if (max < 0) {
      throw new SQLException("max rows must be >= 0");
    }
    maxRows = max;
  }

  @Override
  public void setFetchSize(int i) throws SQLException {
    fetchSize = i;
  }

  @Override
  public int getFetchSize() throws SQLException {
    return fetchSize;
  }

  public void closeClientOperation() throws SQLException {
    if (stmtHandle != null) {
      try {
        clientLock.lock();
        exploreClient.close(stmtHandle);
        stmtHandle = null;
      } catch (HandleNotFoundException e) {
        LOG.error("Ignoring cannot find handle during close.");
      } catch (ExploreException e) {
        LOG.error("Caught exception when closing statement", e);
        throw new SQLException(e.toString(), e);
      } finally {
        clientLock.unlock();
      }
    }
  }

  @Override
  public void close() throws SQLException {
    if (isClosed) {
      return;
    }

    closeClientOperation();
    resultSet = null;
    isClosed = true;
  }

  @Override
  public void cancel() throws SQLException {
    if (isClosed) {
      throw new SQLException("Can't cancel after statement has been closed");
    }
    if (stmtHandle == null) {
      LOG.info("Trying to cancel with no query.");
      return;
    }
    try {
      clientLock.lock();
      exploreClient.cancel(stmtHandle);
    } catch (HandleNotFoundException e) {
      LOG.error("Ignoring cannot find handle during cancel.");
    } catch (ExploreException e) {
      LOG.error("Caught exception when closing statement", e);
      throw new SQLException(e.toString(), e);
    } finally {
      clientLock.unlock();
    }
  }

  @Override
  public Connection getConnection() throws SQLException {
    return connection;
  }

  ReentrantLock getClientLock() {
    return clientLock;
  }

  @Override
  public int executeUpdate(String sql) throws SQLException {
    // We don't support writes in explore yet
    throw new SQLException("Method not supported");
  }

  @Override
  public int getMaxFieldSize() throws SQLException {
    throw new SQLException("Method not supported");
  }

  @Override
  public void setMaxFieldSize(int i) throws SQLException {
    throw new SQLException("Method not supported");
  }

  @Override
  public void setEscapeProcessing(boolean b) throws SQLException {
    throw new SQLException("Method not supported");
  }

  @Override
  public int getQueryTimeout() throws SQLException {
    throw new SQLException("Method not supported");
  }

  @Override
  public void setQueryTimeout(int i) throws SQLException {
    throw new SQLException("Method not supported");
  }

  @Override
  public SQLWarning getWarnings() throws SQLException {
    throw new SQLException("Method not supported");
  }

  @Override
  public void clearWarnings() throws SQLException {
    throw new SQLException("Method not supported");
  }

  @Override
  public void setCursorName(String s) throws SQLException {
    throw new SQLException("Method not supported");
  }

  @Override
  public int getUpdateCount() throws SQLException {
    throw new SQLException("Method not supported");
  }

  @Override
  public boolean getMoreResults() throws SQLException {
    throw new SQLException("Method not supported");
  }

  @Override
  public void setFetchDirection(int i) throws SQLException {
    throw new SQLException("Method not supported");
  }

  @Override
  public int getFetchDirection() throws SQLException {
    throw new SQLException("Method not supported");
  }

  @Override
  public int getResultSetConcurrency() throws SQLException {
    throw new SQLException("Method not supported");
  }

  @Override
  public int getResultSetType() throws SQLException {
    throw new SQLException("Method not supported");
  }

  @Override
  public void addBatch(String s) throws SQLException {
    throw new SQLException("Method not supported");
  }

  @Override
  public void clearBatch() throws SQLException {
    throw new SQLException("Method not supported");
  }

  @Override
  public int[] executeBatch() throws SQLException {
    throw new SQLException("Method not supported");
  }

  @Override
  public boolean getMoreResults(int i) throws SQLException {
    // In case our client.execute returned more than one list of results, which is never the case
    throw new SQLException("Method not supported");
  }

  @Override
  public ResultSet getGeneratedKeys() throws SQLException {
    throw new SQLException("Method not supported");
  }

  @Override
  public int executeUpdate(String s, int i) throws SQLException {
    throw new SQLException("Method not supported");
  }

  @Override
  public int executeUpdate(String s, int[] ints) throws SQLException {
    throw new SQLException("Method not supported");
  }

  @Override
  public int executeUpdate(String s, String[] strings) throws SQLException {
    throw new SQLException("Method not supported");
  }

  @Override
  public boolean execute(String s, int i) throws SQLException {
    throw new SQLException("Method not supported");
  }

  @Override
  public boolean execute(String s, int[] ints) throws SQLException {
    throw new SQLException("Method not supported");
  }

  @Override
  public boolean execute(String s, String[] strings) throws SQLException {
    throw new SQLException("Method not supported");
  }

  @Override
  public int getResultSetHoldability() throws SQLException {
    throw new SQLException("Method not supported");
  }

  @Override
  public boolean isClosed() throws SQLException {
    throw new SQLException("Method not supported");
  }

  @Override
  public void setPoolable(boolean b) throws SQLException {
    throw new SQLException("Method not supported");
  }

  @Override
  public boolean isPoolable() throws SQLException {
    throw new SQLException("Method not supported");
  }

  @Override
  public <T> T unwrap(Class<T> tClass) throws SQLException {
    throw new SQLException("Method not supported");
  }

  @Override
  public boolean isWrapperFor(Class<?> aClass) throws SQLException {
    throw new SQLException("Method not supported");
  }
}
